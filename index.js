const Alexa = require('ask-sdk-core');
const https = require('https');

const API_URL = 'https://fdo.rocketlaunch.live/json/launches/next/5';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ContagemRegressiva/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function localDateString(millis) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(millis);
  const pick = (type) => parts.find((p) => p.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function localTimeString(millis) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit',
  }).format(millis);
}

const XML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (c) => XML_ESCAPE[c]);
}

function cleanMission(value) {
  return escapeXml((value || 'missão não informada').replace(/["""]/g, ''));
}

function launchTimestamp(launch) {
  if (launch.t0) return Date.parse(launch.t0);
  if (launch.sort_date) return launch.sort_date * 1000;
  return null;
}

function isLaunchOnDate(launch, dateValue) {
  const ts = launchTimestamp(launch);
  if (!ts) return false;
  return localDateString(ts) === dateValue;
}

function getSlotDate(handlerInput) {
  const raw = Alexa.getSlotValue(handlerInput.requestEnvelope, 'fecha');
  if (!raw) return { raw: null, date: null };
  return { raw, date: /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null };
}

function todayString() {
  return localDateString(Date.now());
}

function tomorrowString(today) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateString(d.getTime());
}

function onlyTodayTomorrowSpeech() {
  return '<speak>Só tenho informações dos lançamentos de hoje, de amanhã e dos próximos 5 lançamentos. Tente perguntar: tem lançamento amanhã, ou quais são os próximos lançamentos?</speak>';
}

function formatDateLabel(dateValue, today) {
  if (dateValue === today) return 'hoje';
  const t = tomorrowString(today);
  if (dateValue === t) return 'amanhã';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE, day: 'numeric', month: 'long',
    }).format(new Date(`${dateValue}T12:00:00Z`));
  }
  return dateValue;
}

async function fetchLaunchesOn(dateValue) {
  const data = await httpGetJson(API_URL);
  const launches = Array.isArray(data) ? data : (data.result || []);
  return launches.filter((l) => isLaunchOnDate(l, dateValue));
}

async function fetchNextLaunches() {
  const data = await httpGetJson(API_URL);
  const launches = Array.isArray(data) ? data : (data.result || []);
  const upcoming = [];
  for (const l of launches) {
    const ts = launchTimestamp(l);
    if (ts && ts >= Date.now()) {
      upcoming.push({ launch: l, _ts: ts });
    }
  }
  upcoming.sort((a, b) => a._ts - b._ts);
  return upcoming;
}

function describeLaunch(launch) {
  const ts = launchTimestamp(launch);
  const vehicle = escapeXml((launch.vehicle && launch.vehicle.name) || 'um foguete');
  const mission = cleanMission(launch.name);
  const provider = launch.provider && launch.provider.name ? escapeXml(launch.provider.name) : null;
  const pad = launch.pad && launch.pad.name ? escapeXml(launch.pad.name) : null;
  const details = [];
  if (provider) details.push(`pela ${provider}`);
  if (pad) details.push(`a partir de ${pad}`);
  if (ts) details.push(`às ${localTimeString(ts)}`);
  else details.push('em horário ainda não definido');
  return `O ${vehicle}, com a missão ${mission}, ${details.join(', ')}.`;
}

function resultSentence(launches) {
  const count = launches.length;
  if (count === 0) {
    return 'Não há lançamentos de foguete previstos. Os dados são atualizados ao longo do dia, então tente novamente mais tarde.';
  }
  const body = launches.map(describeLaunch).join(' ');
  const total = count === 1 ? 'existe 1 lançamento de foguete' : `existem ${count} lançamentos de foguete`;
  return `${total}. ${body}`;
}

function buildSpeech(dateValue, launches) {
  const label = formatDateLabel(dateValue, todayString());
  return `<speak>Para ${label}, ${resultSentence(launches)} Dados por RocketLaunch ponto Live.</speak>`;
}

function describeNextLaunch(item) {
  const launch = (item && item.launch) ? item.launch : item;
  const ts = (item && item._ts) ? item._ts : launchTimestamp(launch);
  const vehicle = escapeXml((launch.vehicle && launch.vehicle.name) || 'um foguete');
  const mission = cleanMission(launch.name);
  const provider = launch.provider && launch.provider.name ? escapeXml(launch.provider.name) : null;
  const pad = launch.pad && launch.pad.name ? escapeXml(launch.pad.name) : null;
  const day = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE, day: 'numeric', month: 'long',
  }).format(ts);
  const time = localTimeString(ts);
  const details = [];
  if (provider) details.push(`pela ${provider}`);
  if (pad) details.push(`a partir de ${pad}`);
  return `o ${vehicle}, missão ${mission}, no dia ${day} às ${time}${details.length ? `, ${details.join(', ')}` : ''}.`;
}

function buildNextSpeech(launches) {
  if (!launches.length) {
    return '<speak>Ainda não tenho lançamentos futuros confirmados para informar.</speak>';
  }
  const intro = launches.length === 1
    ? 'O próximo lançamento é'
    : `Os próximos ${launches.length} lançamentos são`;
  const body = launches.map((l, i) => `${i === 0 ? '' : 'Em seguida, '}${describeNextLaunch(l)}`).join(' ');
  return `<speak>${intro} ${body} Dados por RocketLaunch ponto Live.</speak>`;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const today = todayString();
    const launches = await fetchLaunchesOn(today);
    const speech = buildSpeech(today, launches);
    return handlerInput.responseBuilder
      .speak(speech)
      .withSimpleCard('Contagem Regressiva', 'Lançamentos de foguete via RocketLaunch.Live')
      .getResponse();
  },
};

const GetLaunchesIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetLaunchesIntent';
  },
  async handle(handlerInput) {
    const today = todayString();
    const tomorrow = tomorrowString(today);
    const { raw, date } = getSlotDate(handlerInput);

    if (date && date !== today && date !== tomorrow) {
      return handlerInput.responseBuilder.speak(onlyTodayTomorrowSpeech()).getResponse();
    }
    if (raw && !date) {
      return handlerInput.responseBuilder.speak(onlyTodayTomorrowSpeech()).getResponse();
    }
    if (!date) {
      const launches = await fetchLaunchesOn(today);
      const speech = `<speak>Eu consulto os lançamentos do dia de hoje. ${resultSentence(launches)} Dados por RocketLaunch ponto Live.</speak>`;
      return handlerInput.responseBuilder.speak(speech).getResponse();
    }
    try {
      const launches = await fetchLaunchesOn(date);
      const speech = buildSpeech(date, launches);
      return handlerInput.responseBuilder.speak(speech).getResponse();
    } catch (err) {
      console.error('Erro ao buscar lançamentos:', err);
      const speech = '<speak>Desculpe, não consegui consultar os lançamentos agora. Verifique sua conexão e tente novamente.</speak>';
      return handlerInput.responseBuilder.speak(speech).getResponse();
    }
  },
};

const GetNextLaunchesIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetNextLaunchesIntent';
  },
  async handle(handlerInput) {
    try {
      const launches = await fetchNextLaunches();
      const speech = buildNextSpeech(launches);
      return handlerInput.responseBuilder.speak(speech).getResponse();
    } catch (err) {
      console.error('Erro ao buscar próximos lançamentos:', err);
      const speech = '<speak>Desculpe, não consegui consultar os lançamentos agora. Verifique sua conexão e tente novamente.</speak>';
      return handlerInput.responseBuilder.speak(speech).getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speech = '<speak>Posso te informar os lançamentos de hoje, de amanhã e os próximos lançamentos. Diga por exemplo: tem lançamento de foguete amanhã, ou quais são os próximos lançamentos?</speak>';
    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const speech = '<speak>Não entendi. Tente perguntar: tem lançamento de foguete hoje, ou quais são os próximos lançamentos?</speak>';
    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Até logo!')
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Erro no handler:', error);
    const speech = '<speak>Ocorreu um erro inesperado. Tente novamente.</speak>';
    return handlerInput.responseBuilder.speak(speech).getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    GetLaunchesIntentHandler,
    GetNextLaunchesIntentHandler,
    HelpIntentHandler,
    FallbackIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
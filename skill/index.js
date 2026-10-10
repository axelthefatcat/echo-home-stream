/*
 * Home Radio - a minimal Alexa skill that plays your own live audio stream on an Echo.
 * Full guide: see README.md in this repository.
 *
 *   "Alexa, open home radio"              -> starts playing
 *   "Alexa, ask home radio to play"       -> starts playing
 *   "Alexa, pause" / "Alexa, stop"        -> stops
 *   "Alexa, resume"                       -> starts again (it's live, so it picks up whatever is playing now)
 *
 * Paste this over index.js in the skill's Code tab (Alexa-hosted, Node.js), then Save and Deploy.
 */
const Alexa = require('ask-sdk-core');

// ---- change these two lines ----
const STREAM_URL = 'https://radio.yourname.synology.me/stream?key=YOUR-KEY';   // must be HTTPS on port 443, trusted certificate
const STATION_NAME = 'Home Radio';                                                // shown on Echo screens / in the Alexa app
// --------------------------------

// Replies to the device's own buttons (PlaybackController) mustn't say anything or end a session
const fromButton = (handlerInput) =>
    Alexa.getRequestType(handlerInput.requestEnvelope).startsWith('PlaybackController.');

function startStream(handlerInput, speech) {
    const builder = handlerInput.responseBuilder;
    if (speech) builder.speak(speech);
    builder
        .addAudioPlayerPlayDirective(
            'REPLACE_ALL',
            STREAM_URL,
            'stream-' + Date.now(),   // a new token each time, so Alexa always reconnects to the live stream
            0,
            null,
            { title: STATION_NAME, subtitle: 'Live' });
    if (!fromButton(handlerInput)) builder.withShouldEndSession(true);
    return builder.getResponse();
}

function stopStream(handlerInput) {
    const builder = handlerInput.responseBuilder.addAudioPlayerStopDirective();
    if (!fromButton(handlerInput)) builder.withShouldEndSession(true);
    return builder.getResponse();
}

const isRequest = (handlerInput, type) => Alexa.getRequestType(handlerInput.requestEnvelope) === type;
const isIntent = (handlerInput, ...names) =>
    isRequest(handlerInput, 'IntentRequest') && names.includes(Alexa.getIntentName(handlerInput.requestEnvelope));

// "Alexa, open home radio" / "Alexa, ask home radio to play"
const PlayHandler = {
    canHandle: (h) => isRequest(h, 'LaunchRequest') || isIntent(h, 'PlayRadioIntent'),
    handle: (h) => startStream(h, `Here's ${STATION_NAME}.`)
};

// "Alexa, resume" or the play button on the device / in the Alexa app
const ResumeHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.ResumeIntent') || isRequest(h, 'PlaybackController.PlayCommandIssued'),
    handle: (h) => startStream(h)
};

// "Alexa, pause / stop / cancel" or the pause button
const StopHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.PauseIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent')
        || isRequest(h, 'PlaybackController.PauseCommandIssued'),
    handle: (h) => stopStream(h)
};

// Skip, shuffle etc. make no sense for a live stream
const UnsupportedHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.NextIntent', 'AMAZON.PreviousIntent', 'AMAZON.StartOverIntent',
        'AMAZON.RepeatIntent', 'AMAZON.LoopOnIntent', 'AMAZON.LoopOffIntent', 'AMAZON.ShuffleOnIntent',
        'AMAZON.ShuffleOffIntent'),
    handle: (h) => h.responseBuilder
        .speak("It's a live stream, so I can't skip or shuffle it.")
        .getResponse()
};

const HelpHandler = {
    canHandle: (h) => isIntent(h, 'AMAZON.HelpIntent', 'AMAZON.FallbackIntent', 'AMAZON.NavigateHomeIntent'),
    handle: (h) => h.responseBuilder
        .speak(`${STATION_NAME} plays your live stream. Say play to start, or stop to finish.`)
        .reprompt('Say play to start.')
        .getResponse()
};

// Status messages from the Echo (started, stopped, failed...) and device buttons we don't use.
// Alexa doesn't allow speech in reply to these, so just acknowledge them.
const SilentHandler = {
    canHandle: (h) => {
        const type = Alexa.getRequestType(h.requestEnvelope);
        return type.startsWith('AudioPlayer.') || type.startsWith('PlaybackController.')
            || type === 'SessionEndedRequest' || type === 'System.ExceptionEncountered';
    },
    handle: (h) => {
        const type = Alexa.getRequestType(h.requestEnvelope);
        if (type === 'AudioPlayer.PlaybackFailed' || type === 'System.ExceptionEncountered')
            console.log('Problem:', JSON.stringify(h.requestEnvelope.request));
        return h.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle: () => true,
    handle: (h, error) => {
        console.log('Error:', error && error.stack);
        const type = Alexa.getRequestType(h.requestEnvelope);
        if (type.startsWith('AudioPlayer.') || type.startsWith('PlaybackController.') || type.startsWith('System.'))
            return h.responseBuilder.getResponse();
        return h.responseBuilder.speak("Sorry, I couldn't start the stream just now.").getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        PlayHandler,
        ResumeHandler,
        StopHandler,
        UnsupportedHandler,
        HelpHandler,
        SilentHandler)
    .addErrorHandlers(ErrorHandler)
    .lambda();

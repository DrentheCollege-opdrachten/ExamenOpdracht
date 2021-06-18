import xapi from 'xapi'
const fallbackLanguage = 'dutch'; // languages: english, dutch
const useMonitorName = true; // monitor names are in variable connectornames
const text = {
    'english': {
        shareToPrimaryScreenWarning: "the preview on this monitor will stop when a call has been connected.",
        resetButtonMessage: "All previews have been stopped",
        promptOptions: {
            text: "To which screen do you want to share?",
            title: "Share Screen",
            option5: "Stop Preview"
        },
    },
    'dutch': {
        shareToPrimaryScreenWarning: 'het voorbeeld van deze invoer wordt verwijderd als een gesprek begonnen wordt.',
        resetButtonMessage: "Alle voorbeelden zijn gestopt",
        promptOptions: {
            text: "Naar welk scherm wil je delen?",
            title: "Scherm delen",
            option5: "Stop delen"
        }
    },
};
const connectorNames = [
    'display 1',
    'display 2',
    'display 3', // output connector 3
];
//////////////////// DO NOT ANYTHING EDIT PAST THIS //////////////////// 
/**
 * De volgende 3 lijnen code zorgen ervoor dat er naar de events geluisterd wordt
 * de events waar naar geluisterd worden zijn als volgt:
 *      Call.Status: dit event wordt uitgestuurd als de status van het gesprek veranderd. dit wordt gebruikt voor het kijken of een gesprek gestart wordt
 *      PresentationPreviewStarted: dit is het event die uitgestuurd wordt als je een voorbeeld wilt bekijken
 *      Panel.Clicked: dit is het event voor de resetknop
 */
// xapi.Event.CallDisconnect.on(callDisconnected)
xapi.Status.Call.Status.on(callStatusChanged);
xapi.Event.PresentationPreviewStarted.on(presentationPreviewStartEvent);
xapi.Event.UserInterface.Extensions.Panel.Clicked.on(resetbuttonPressed);
/**
 * deze functies zijn om de taal aan te passen.
 * de eerste functie runt als de macro gestart wordt en de 2de als je de taal aanpast.
 */
let language = fallbackLanguage;
xapi.Config.UserInterface.Language.get().then((lang) => {
    // initail run
    if (text[lang.toLocaleLowerCase()]) {
        language = lang.toLowerCase();
    }
});
xapi.Config.UserInterface.Language.on(lang => {
    // language change
    if (text[lang.toLocaleLowerCase()]) {
        language = lang.toLowerCase();
    }
    else {
        language = fallbackLanguage;
    }
});
/**
 * deze klasse is voor het onthouden van de status van wat op welk scherm staat
 */
export class MatrixState {
    constructor(initialState = {}) {
        this.state = initialState;
    }
    getInputOutputs(input) {
        if (!this.state[input]) {
            return [];
        }
        return this.state[input];
    }
    setInputOutput(input, output) {
        if (!this.state[input]) {
            this.clearInputState(input);
        }
        Object.keys(this.state).forEach((key) => {
            const i = this.state[key].indexOf(output);
            if (i !== -1) {
                this.state[key].pop(i, i);
            }
        });
        this.state[input].push(output);
    }
    getFullState() {
        return this.state;
    }
    clearState() {
        Object.keys(this.state).forEach((key) => {
            this.clearInputState(parseInt(key));
        });
    }
    clearInputState(input) {
        this.state[input] = [];
    }
    toString() {
        return JSON.stringify(this.state);
    }
}
let state = new MatrixState();
/**
 *  deze functie wordt geroepen als je op de voorbeeld knop drukt om een preview te krijgen
 *  deze functie zorgt dat je de popup te zien krijgt en zorgt er ook voor dat het goede input
 *  op de correcte output te zien wordt
 *
 * @param {object} previewStartedEvent
 * @returns
 */
export function presentationPreviewStartEvent(previewStartedEvent) {
    if (previewStartedEvent.Cause !== 'userRequested') {
        return;
    }
    const inputConnectorId = parseInt(previewStartedEvent.LocalSource);
    xapi.Command.Presentation.Stop({ PresentationSource: inputConnectorId });
    // get the name of the outputs to create a options select the display or stop previewing
    xapi.Status.Video.Output.Connector.get().then((connectors) => {
        // if we are in a call we wont show the prompt but just display it to the third screen
        let inCall = false;
        xapi.Status.Call.Status.get()
            .then((status) => { inCall = (status === 'Connected'); })
            .catch(() => { inCall = false; })
            .finally(() => {
            let conns = connectors;
            if (inCall) {
                conns = connectors.filter((conn) => conn.Connected).filter((conn) => {
                    return ![
                        "First",
                        "Recorder",
                        "PresentationOnly",
                        'InternalSetup'
                    ].includes(conn.MonitorRole);
                });
            }
            // if there is only one monitor left we show iton that monitor with
            if (conns.length >= 1) {
                startPreview(inputConnectorId, parseInt(conns.pop().id));
                return;
            }
            // we create a propmt so the user can select to which display they want to output.
            // we also add a option so we can stop the previews for the inputs
            const promptId = "ShareToScreen" + Date.now().toString(16);
            const { promptOptions, optionIndex } = generatePromptOptions(conns, promptId);
            // show the prompt
            xapi.Command.UserInterface.Message.Prompt.Display(promptOptions);
            const promptFeedbackEvent = xapi.Event.UserInterface.Message.Prompt.Response.on((promptResponse) => {
                // if the id for the feedback does not match we ignore the option
                if (promptResponse.FeedbackId === promptId) {
                    // stop the feedbackEvent to prevent a memory leak
                    promptFeedbackEvent();
                    // if the id of the option matches the id to stop the previews we stop all previews
                    if (promptResponse.OptionId === optionIndex.toString()) {
                        stopPreview(inputConnectorId);
                    }
                    else {
                        const outputConnector = connectors.find((connector, index) => {
                            return (connector.ConnectedDevice.Name === promptOptions[`Option.${promptResponse.OptionId}`] ||
                                connectorNames.indexOf(promptOptions[`Option.${promptResponse.OptionId}`]) === index);
                        });
                        startPreview(inputConnectorId, parseInt(outputConnector.id));
                        if (outputConnector.MonitorRole === 'First') {
                            sendMessage(text[language].shareToPrimaryScreenWarning);
                        }
                    }
                }
            });
        });
    });
}
/**
 * dit is een functie om een bericht te laten zien op het primaire scherm
 *
 * @param {string} text
 */
export function sendMessage(text) {
    xapi.Command.UserInterface.Message.TextLine.display({
        Text: text,
        Duration: 3,
        X: 10000,
        Y: 1100
    });
}
/**
 * deze functie is verantwoordelijk voor het starten van de preview.
 *
 * @param {number} inputConnectorId
 * @param {number} outputConnectorId
 */
export function startPreview(inputConnectorId, outputConnectorId) {
    xapi.Command.Video.Matrix.Assign({ Output: outputConnectorId, SourceId: inputConnectorId });
    state.setInputOutput(inputConnectorId, outputConnectorId);
}
/**
 * deze functie is verantwoordelijk voor het stoppen van de preview
 *
 * @param {number} inputConnectorId
 */
export function stopPreview(inputConnectorId) {
    // grab all the outputs that are displaying a specific inputs 
    const outputs = state.getInputOutputs(inputConnectorId);
    outputs.forEach((output) => {
        xapi.Command.Video.Matrix.Reset({ Output: output });
    });
    state.clearInputState(inputConnectorId);
}
/**
 * deze functie is verantwoordelijk voor het genereren van de opties voor de pop-up
 *
 * @param {Array<Object>} connectors
 * @param {number} feedbackId
 * @returns
 */
export function generatePromptOptions(connectors, feedbackId) {
    const promptOptions = {
        FeedbackId: feedbackId,
        Text: text[language].promptOptions.text,
        Title: text[language].promptOptions.title
    };
    let optionIndex = 1;
    // loop over all the connectors
    connectors.forEach((connector, index) => {
        var _a;
        // if the connector is not connected or the primary display we wont include it when in a call.
        // but we will include it when we are not in a call
        if (connector.Connected !== 'True' || connector.MonitorRole === 'Recorder') {
            return;
        }
        promptOptions[`Option.${optionIndex}`] = useMonitorName ? (_a = connector.ConnectedDevice.Name) !== null && _a !== void 0 ? _a : connectorNames[index] : connectorNames[index];
        optionIndex++;
    });
    // add the option for canceling the preview
    promptOptions['Option.5'] = text[language].promptOptions.option5;
    return { promptOptions, optionIndex };
}
/**
 * deze functie is verantwoordelijk voor het aanpassen van de schermen een gesprek gestart is
 *
 * @param {string} CallStatus
 */
export function callStatusChanged(CallStatus) {
    // we only want to change the monitors role when we are calling
    if (CallStatus === 'Connected') {
        xapi.Config.Video.Output.Connector.get().then((connectors) => {
            // we look for the monitors selected as primary and 
            const recorderConnector = connectors.find((conn) => conn.MonitorRole === 'First');
            if (recorderConnector) {
                const recorderConnectorId = parseInt(recorderConnector.id);
                xapi.Command.Video.Matrix.Reset({ Output: recorderConnectorId });
                xapi.Config.Video.Output.Connector[recorderConnectorId].MonitorRole.set('Recorder');
            }
        });
    }
}
export function callDisconnected(disconnectionEvent) {
    xapi.Config.Video.Output.Connector.get().then((connectors) => {
        const recorederConnector = connectors.find((conn) => conn.MonitorRole === 'Recorder');
        if (recorederConnector) {
            xapi.Config.Video.Output.Connector[recorederConnector.id].MonitorRole.set('First');
        }
    });
}
/**
 * deze functie wordt geroepen als de resetknop ingedrukt wordt
 *
 * @param {object} event
 */
export function resetbuttonPressed(event) {
    if (event.PanelId = 'reset_all_display') {
        resetMatrix();
        sendMessage(text[language].resetButtonMessage);
    }
}
/**
 * deze functie reset alle schermen
 */
export function resetMatrix() {
    for (let i = 0; i < 3; i++) {
        xapi.Command.Video.Matrix.Reset({ Output: i });
    }
    state.clearState();
}

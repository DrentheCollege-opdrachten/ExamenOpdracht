import { xapi, DisplayPrompt, OutputConnectorConfiguration, OutputConnectorStatus } from './xapi';
let xapi: xapi;

const fallbackLanguage = 'dutch'; // languages: english, dutch
const useMonitorName = true // monitor names are in variable connectornames


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
}

const connectorNames = [
    'display 1', // output connector 1
    'display 2', // output connector 2
    'display 3', // output connector 3
]

//////////////////// DO NOT ANYTHING EDIT PAST THIS //////////////////// 
// all events 
xapi.Event.CallDisconnect.on(callDisconnected)
xapi.Status.Call.Status.on(callStatusChanged)
xapi.Event.PresentationPreviewStarted.on(presentationPreviewStartEvent)
xapi.Event.UserInterface.Extensions.Panel.Clicked.on(resetbuttonPressed);

// setup for the language 
let language = fallbackLanguage;
xapi.Config.UserInterface.Language.get().then((lang) => {
    // initail run
    if (text[lang.toLocaleLowerCase()]) {
        language = lang.toLowerCase()
    }
})
xapi.Config.UserInterface.Language.on(lang => {
    // language change
    if (text[lang.toLocaleLowerCase()]) {
        language = lang.toLowerCase();
    } else {
        language = fallbackLanguage;
    }
})
// class to handle the displays state
export class MatrixState {
    state: {
        1?: Array<number>;
        2?: Array<number>;
        3?: Array<number>;
        4?: Array<number>;
        5?: Array<number>;
    };
    constructor(initialState = {}) {
        this.state = initialState;
    }
    getInputOutputs(input: number): Array<number> {
        if (!this.state[input]) {
            return []
        }
        return this.state[input];
    }

    setInputOutput(input: number, output: number) {
        if (!this.state[input]) {
            this.clearInputState(input)
        }
        this.state[input].push(output);
    }
    getFullState() {
        return this.state
    }

    clearState() {
        Object.keys(this.state).forEach((key) => {
            this.clearInputState(parseInt(key))
        })
    }

    clearInputState(input: number) {
        this.state[input] = []
    }

    toString() {
        return JSON.stringify(this.state);
    }

}
let state = new MatrixState();

export function presentationPreviewStartEvent(previewStartedEvent) {
    if (previewStartedEvent.Cause !== 'userRequested') { return }
    const inputConnectorId = parseInt(previewStartedEvent.LocalSource);

    xapi.Command.Presentation.Stop({ PresentationSource: inputConnectorId });

    // get the name of the outputs to create a options select the display or stop previewing
    xapi.Status.Video.Output.Connector.get().then((connectors) => {
        // we create a propmt so the user can select to which display they want to output.
        // we also add a option so we can stop the previews for the inputs
        const promptId = "ShareToScreen" + Date.now().toString(16);
        const { promptOptions, optionIndex } = generatePromptOptions(connectors, promptId)
        // show the prompt
        xapi.Command.UserInterface.Message.Prompt.Display(promptOptions);
        const promptFeedbackEvent = xapi.Event.UserInterface.Message.Prompt.Response.on((promptResponse) => {

            // if the id for the feedback does not match we ignore the option
            if (promptResponse.FeedbackId === promptId) {
                // stop the feedbackEvent to prevent a memory leak
                promptFeedbackEvent();

                // if the id of the option matches the id to stop the previews we stop all previews
                if (promptResponse.OptionId === optionIndex.toString()) {
                    stopPreview(inputConnectorId)
                } else {
                    const outputConnector = connectors.find((connector, index) => {


                        return (
                            connector.ConnectedDevice.Name === promptOptions[`Option.${promptResponse.OptionId}`] ||
                            connectorNames.indexOf(promptOptions[`Option.${promptResponse.OptionId}`]) === index
                        )

                    })

                    startPreview(inputConnectorId, parseInt(outputConnector.id))

                    if (outputConnector.MonitorRole === 'First') {
                        sendMessage(text[language].shareToPrimaryScreenWarning);
                    }
                }
            }

        })
    })
}
// send a message to the user.
export function sendMessage(text: string) {
    xapi.Command.UserInterface.Message.TextLine.display({
        Text: text,
        Duration: 3,
        X: 10000,
        Y: 1100
    })
}
// start the preview of the input at the selected display
export function startPreview(inputConnectorId: number, outputConnectorId: number) {
    xapi.Command.Video.Matrix.Assign({ Output: outputConnectorId, SourceId: inputConnectorId });
    state.setInputOutput(inputConnectorId, outputConnectorId);
}

export function stopPreview(inputConnectorId: number) {
    // grab all the outputs that are displaying a specific inputs 
    const outputs = state.getInputOutputs(inputConnectorId)
    outputs.forEach((output) => {
        xapi.Command.Video.Matrix.Reset({ Output: output })
    })
    state.clearInputState(inputConnectorId);
}


export function generatePromptOptions(connectors: OutputConnectorStatus[], feedbackId) {
    const promptOptions: DisplayPrompt = {
        FeedbackId: feedbackId,
        Text: text[language].promptOptions.text,
        Title: text[language].promptOptions.title
    }

    let optionIndex = 1
    // loop over all the connectors
    connectors.forEach((connector, index) => {
        // if the connector is not connected or the primary display we wont include it when in a call.
        // but we will include it when we are not in a call
        if (connector.Connected !== 'True' || connector.MonitorRole === 'Recorder') {
            return;
        }

        promptOptions[`Option.${optionIndex}`] = useMonitorName ? connector.ConnectedDevice.Name ?? connectorNames[index] : connectorNames[index]
        optionIndex++
    });
    // add the option for canceling the preview
    promptOptions['Option.5'] = text[language].promptOptions.option5;

    return { promptOptions, optionIndex }
}


export function callStatusChanged(CallStatus) {
    // we only want to change the monitors role when we are calling
    if (CallStatus === 'Connected') {
        xapi.Config.Video.Output.Connector.get().then((connectors: Array<OutputConnectorConfiguration>) => {
            // we look for the monitors selected as primary and 
            const recorderConnector = connectors.find((conn) => conn.MonitorRole === 'First');

            if (recorderConnector) {
                const recorderConnectorId = parseInt(recorderConnector.id)
                xapi.Command.Video.Matrix.Reset({ Output: recorderConnectorId })
                xapi.Config.Video.Output.Connector[recorderConnectorId].MonitorRole.set('Recorder');
            }
        })
    }
}

export function callDisconnected(disconnectionEvent) {
    xapi.Config.Video.Output.Connector.get().then((connectors: Array<OutputConnectorConfiguration>) => {
        const recorederConnector = connectors.find((conn) => conn.MonitorRole === 'Recorder');
        if (recorederConnector) {
            xapi.Config.Video.Output.Connector[recorederConnector.id].MonitorRole.set('First');
        }
    })
}

export function resetbuttonPressed(event) {
    if (event.PanelId = 'reset_all_display') {
        resetMatrix();
        sendMessage(text[language].resetButtonMessage)
    }
}

export function resetMatrix() {
    for (let i = 0; i < 3; i++) {
        xapi.Command.Video.Matrix.Reset({ Output: i })
    }

    state.clearState();
}
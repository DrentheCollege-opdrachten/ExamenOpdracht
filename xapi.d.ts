export interface xapi {
    Status?: {
        Video: {
            Output: {
                Connector: {
                    get(): Promise<Array<OutputConnectorStatus>>; // een api request om de huidige status op te halen 
                    on(callback: (connnector: OutputConnectorStatus) => void): void; // een  "websocket" die veranderingen in de status geven 
                };
            };
            Input: {
                Connector: {
                    get(): Promise<Array<InputConnectorStatus>>;
                    on(callback: (connector: InputConnectorStatus) => void): void;
                }
            }
        };
        Call: {
            Status: {
                get(): Promise<CallStatusType>;
                on(callback: (callStatus: CallStatusType) => void): void;
            }
        }
    };
    Config?: {
        Video: {
            Input: {
                Connector: {
                    get(): Promise<Array<InputConnectorConfig>>;
                }
            };
            Output: {
                Connector: any;
            }
        };
        UserInterface: {
            Language: {
                get(): Promise<string>;
                on(callback: (newLanguage: string) => void): void;
            }
        }
    };
    Command?: {
        Video: {
            Matrix: {
                Assign(Object: {
                    SourceId: number;
                    Output: number;
                }): void;
                Reset(Options?: {
                    Output: number
                }): void;
                Unassign(options: {
                    Output: number
                    RemoteMain?: number
                    SourceId: number
                }): void;
            }
        };
        Presentation: {
            Start(Object: { ConnectorId: number; }): void;
            Stop(setting?: { instance?: number, PresentationSource?: number }): void;
        };
        UserInterface: {
            Message: {
                Prompt: {
                    Display(options: DisplayPrompt): void
                };
                TextLine: {
                    display(Options: {
                        Duration?: number;
                        Text: string;
                        X?: number;
                        Y?: number;
                    }): void;
                }
            }
        }
    };
    Event?: {
        PresentationPreviewStarted: {
            on(callback: (event: PresentationPreview) => void): () => void;
        };
        PresentationPreviewStopped: {
            on(callback: (event: PresentationPreview) => void): () => void;
        }
        UserInterface: {
            Message: {
                Prompt: {
                    Response: {
                        on(callback: (event: { FeedbackId: string, OptionId: string, id: string }) => void): () => void;
                    }
                }
            };
            Extensions: {
                Panel: {
                    Clicked: {
                        on(callback: (event: {
                            PanelId: string,
                            id: string
                        }) => void): () => void;
                    }
                }
            }
        };
        CallDisconnect: {
            on(callback: (event: CallDisconnectEvent) => void): () => void;
        };
        Room: {
            Reset(callback: (Event: any) => void): () => void;
        }
    }
}

export interface InputConnectorConfig {
    InputSourceType: InputSourceTypeType;
    Name: String; // max 50 char
    PresentationSelection: PresentationSelectionType;
    Quality: QualityType;
    Visibility: VisibilityType;
    CameraControll: {
        CameraId: 1 | 2 | 3 | 4 | 5 | 6 | 7;
        Mode: OnOffType;
    };
}

export interface OutputConnectorStatus {
    id: string;
    Connected: BooleanStringType | "Unknown";
    MonitorRole: MonitorRoleType;
    Type: ConnectorTypeType;
    Resolution: {
        Height: string;         // number verzonden als string
        Width: string;          // number verzonden als string
        RefreshRate: string;    // number verzonden als string
    }
    ConnectedDevice: {
        Name: string;
        PreferredFormat: string;
        screenSize: string;
        CEC: {};
    }
}

export interface InputConnectorStatus {
    Connected: BooleanStringType | "Unknown";
    SignalState: SignalStateType;
    SourceId: String; // een getal in een string
    Type: InputTypeType
}

export interface assignMatrix {
    SourceId: number;
    Output: Number;
}

export interface PresentationPreview {
    Cause: string;
    Instance: string;
    LocalSource: '1' | '2' | '3' | '4' | '5'
    id: string;
}

export interface DisplayPrompt {
    Title: string;
    FeedbackId: string;
    Text: string;
    Duration?: string;
    "Option.1"?: string;
    "Option.2"?: string;
    "Option.3"?: string;
    "Option.4"?: string;
    "Option.5"?: string;
}
export interface CallDisconnectEvent {
    CallId: string;
    CallRate: string;
    CallType: string;
    CauseCode: string;
    CauseOrigin: string;
    CauseString: string;
    CauseType: string;
    CauseValue: string;
    DisplayName: string;
    Duration: string;
    Encryption: string;
    OrigCallDirection: string;
    PeopleCountAverage: string;
    Protocol: string;
    RemoteURI: string;
    RequestedURI: string;
    id: string;
}

export interface OutputConnectorConfiguration {
    CEC: {
        Mode: OnOffType
    };
    Location: {
        HorizontalOffset: string;
        VerticalOffset: string;
    };
    MonitorRole: MonitorRoleType;
    Resolution: string;
    id: string
}

export type CallStatusType = "Connected" | "Connecting" | "Dialing" | "Disconnecting" | "EarlyMedia" | "Idle" | "onHold" | "Preserved" | "RemotePreserved" | "Ringing";
export type BooleanStringType = "True" | "False";
export type SignalStateType = "OK" | "Unstable" | "NotFound" | "Unkown" | "Unsupported";
export type InputTypeType = "Camera" | "Composite" | "DVI" | "3G-SDI" | "HD-SDI" | "USBC-DP" | "HDMI" | "USB" | "Unknown" | "VGA" | "YC" | "YPbPr";
export type MonitorRoleType = "First" | "InternalSetup" | "PresentationOnly" | "Recorder" | "Second" | "Third";
export type ConnectorTypeType = "HDMI" | "DVI" | "LCD" | "Legacy" | "Internal";
export type InputSourceTypeType = "PC" | "camera" | "document_camera" | "mediaplayer" | "other" | "whiteboard";
export type OnOffType = "On" | "Off";
export type PresentationSelectionType = "AutoShare" | "Desktop" | "Manual" | "OnConnect";
export type QualityType = "Motion" | "Sharpness";
export type VisibilityType = "Always" | "IfSignal" | "Never";
export type OutputConnectorConfigType = { get(): Promise<Array<OutputConnectorConfiguration>> } | [{ MonitorRole(role: MonitorRoleType) }];
import React from "react";

interface AutoCompleteProps {
    placeholder: string;
    completions: string[];
    onShow: (value: string) => void;
}

class Completion {
    public value: string;
    private valueLower: string;

    constructor(value: string) {
        this.value = value;
        this.valueLower = value.toString();
    }

    isMatch(input: string) {
        if (input.length == 0) {
            return false;
        }

        return this.valueLower.startsWith(input);
    }
}

interface AutoCompleteState {
    completions: Completion[];
    input: string;
    typed: boolean;
}

export class AutoCompleteInput extends React.Component<AutoCompleteProps, AutoCompleteState> {
    completionListRef = React.createRef<HTMLUListElement>();

    constructor(props) {
        super(props);

        this.state = {
            completions: [],
            input: "",
            typed: false
        };
    }

    componentDidUpdate(prevProps: Readonly<AutoCompleteProps>, prevState: Readonly<AutoCompleteState>, snapshot?: any) {
        if (this.props != prevProps) {
            this.setState({
                completions: this.props.completions.map(completion => new Completion(completion))
            });
        }
    }

    render() {
        let completions = this.getCompletions();

        return (
            <div style={{width: "50em"}}>
                <div className="input-group">
                    <input
                        type="text"
                        className={`form-control ${completions.length > 0 ? "auto-complete-input-visible" : ""}`}
                        placeholder={this.props.placeholder}
                        value={this.state.input}
                        onChange={event => {
                            this.setState({
                                input: event.target.value,
                                typed: true
                            });
                        }}
                        autoComplete="off"
                        onKeyDown={event => {
                            if (event.key == "Enter") {
                                this.props.onShow(this.state.input);
                            }
                        }}
                    />

                    <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => { this.props.onShow(this.state.input); }}
                    >
                        Show
                    </button>
                </div>

                {
                    completions.length > 0 ? (
                        <ul
                            ref={this.completionListRef}
                            className="dropdown-menu auto-complete-dropdown-visible show"
                            style={{ width: "50em" }}
                        >
                            {
                                completions.map((completion, index) =>
                                    <li key={index}>
                                        <a
                                            className="dropdown-item"
                                            onClick={() => {
                                                this.setState({
                                                    input: completion.value,
                                                    typed: false
                                                });
                                            }}
                                        >
                                            {completion.value}
                                        </a>
                                    </li>
                                )
                            }
                        </ul>
                    ) : null
                }
            </div>
        );
    }

    getCompletions() {
        if (!this.state.typed) {
            return [];
        }

        let inputLower = this.state.input.toLowerCase();
        let results = [];
        for (let completion of this.state.completions) {
            if (completion.isMatch(inputLower)) {
                results.push(completion);
            }

            if (results.length >= 10) {
                break;
            }
        }

        return results;
    }
}
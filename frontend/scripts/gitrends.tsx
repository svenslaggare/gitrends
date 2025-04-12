import React, {useEffect} from "react";
import ReactDOM from 'react-dom'

import {BrowserRouter as Router, Link, Route, Switch, useLocation} from "react-router-dom";

import axios from "axios";

import {ChangeCouplingView} from "./views/changeCoupling";
import {HotspotsView} from "./views/hotspots";
import {HotspotsAnalysisType, HotspotsStructureView} from "./views/hotspotsStructure";
import {AlertBox, EntryType} from "./helpers/view";
import {getErrorMessage} from "./helpers/misc";
import {TimelineView} from "./views/timeline";
import {ChangeCouplingStructureView} from "./views/changeCouplingStructure";
import {ModulesBreakdownType, ModulesView} from "./views/modules";
import {HomeView} from "./views/home";
import {MainDeveloperView} from "./views/mainDeveloper";
import {MainDeveloperStructureView} from "./views/mainDeveloperStructure";
import {CustomAnalysisView} from "./views/customAnalysis";
import {CommitSpreadView} from "./views/commitSpread";
import {AppConfig, loadPersistedConfig} from "./config";
import {ConfigurationView} from "./views/configuration";

interface ApplicationMainProps {

}

interface ApplicationMainState {
    errorMessage: string;

    config: AppConfig;

    autoCompletionFiles: string[];
    autoCompletionModules: string[];
}

class ApplicationMain extends React.Component<ApplicationMainProps, ApplicationMainState> {
    constructor(props) {
        super(props);

        this.state = {
            errorMessage: null,
            config: loadPersistedConfig(),
            autoCompletionFiles: [],
            autoCompletionModules: [],
        };

        this.fetchAutoCompletionFiles();
        this.fetchAutoCompletionModules();
    }

    render() {
        return (
            <div>
                {this.renderTopbar()}

                <div className="container-fluid">
                    <div className="row">
                        <Router>
                            <ScrollToTop/>

                            {this.renderSidebar()}
                            {this.renderMain()}
                        </Router>
                    </div>
                </div>
            </div>
        );
    }

    renderTopbar() {
        return (
            <header className="navbar sticky-top bg-dark flex-md-nowrap p-0 shadow" data-bs-theme="dark">
                <a className="navbar-brand col-md-3 col-lg-2 me-0 px-3 fs-6 text-white" href="/">
                    <img alt="Gitrends" src="/content/images/Logo.png" width="200em" />
                </a>

                <ul className="navbar-nav flex-row d-md-none">
                    <li className="nav-item text-nowrap">
                        <button
                            className="nav-link px-3 text-white" type="button" data-bs-toggle="collapse"
                            data-bs-target="#navbarSearch" aria-controls="navbarSearch" aria-expanded="false"
                            aria-label="Toggle search"
                        >
                        </button>
                    </li>
                    <li className="nav-item text-nowrap">
                        <button
                            className="nav-link px-3 text-white" type="button" data-bs-toggle="offcanvas"
                            data-bs-target="#sidebarMenu" aria-controls="sidebarMenu" aria-expanded="false"
                            aria-label="Toggle navigation"
                        >
                        </button>
                    </li>
                </ul>

                <div id="navbarSearch" className="navbar-search w-100 collapse">
                    <input className="form-control w-100 rounded-0 border-0" type="text" placeholder="Search" aria-label="Search"/>
                </div>
            </header>
        );
    }

    renderSidebar() {
        return (
            <div className="sidebar border border-right col-md-3 col-lg-2 p-0 bg-body-tertiary">
                <div className="offcanvas-md offcanvas-end bg-body-tertiary" tabIndex={-1} id="sidebarMenu"
                     aria-labelledby="sidebarMenuLabel">
                    <div className="offcanvas-header">
                        <h5 className="offcanvas-title" id="sidebarMenuLabel">Gitrends</h5>
                        <button
                            type="button" className="btn-close" data-bs-dismiss="offcanvas"
                            data-bs-target="#sidebarMenu" aria-label="Close"
                        >
                        </button>
                    </div>
                    <div className="offcanvas-body d-md-flex flex-column p-0 pt-lg-3 overflow-y-auto">
                        <ul className="nav flex-column">
                            <li className="nav-item">
                                <RenderLink to="/">
                                    <i className="fa-solid fa-house" />
                                    Home
                                </RenderLink>
                            </li>

                            <li className="nav-item">
                                <RenderLink to="/timeline">
                                    <i className="fa-solid fa-timeline" />
                                    Timeline
                                </RenderLink>
                            </li>

                            <li className="nav-item">
                                <RenderLink to="/modules">
                                    <i className="fa-solid fa-folder" />
                                    Modules
                                </RenderLink>
                            </li>

                            <li className="nav-item">
                                <RenderDualLink
                                    to1={"/hotspots"}
                                    to2={"/hotspots-structure"}
                                    secondaryLink={<i className="fa-solid fa-sitemap"/>}
                                >
                                    <i className="fa-solid fa-fire"/>
                                    Hotspots
                                </RenderDualLink>
                            </li>

                            <li className="nav-item">
                                <RenderDualLink
                                    to1={"/change-coupling"}
                                    to2={"/change-coupling-structure"}
                                    secondaryLink={<i className="fa-solid fa-sitemap"/>}
                                >
                                    <i className="fa-solid fa-link"/>
                                    Change coupling
                                </RenderDualLink>
                            </li>

                            <li className="nav-item">
                                <RenderDualLink
                                    to1={"/main-developer"}
                                    to2={"/main-developer-structure"}
                                    secondaryLink={<i className="fa-solid fa-sitemap"/>}
                                >
                                    <i className="fa-regular fa-user"/>
                                    Main developer
                                </RenderDualLink>
                            </li>

                            <li className="nav-item">
                                <RenderLink to="/commit-spread">
                                    <i className="fa-solid fa-code-commit" />
                                    Commit spread
                                </RenderLink>
                            </li>

                            <li className="nav-item">
                                <RenderLink to="/custom-analysis">
                                    <i className="fa-solid fa-database" />
                                    Custom analysis
                                </RenderLink>
                            </li>
                        </ul>

                        <hr className="my-3"/>

                        <ul className="nav flex-column mb-auto">
                            <li className="nav-item">
                                <Link className="nav-link d-flex align-items-center gap-2" to="/configuration">
                                    <i className="fa-solid fa-gear" /> Configuration
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    renderMain() {
        return (
            <main className="col-md-9 ms-sm-auto col-lg-10 px-md-4">
                <AlertBox
                    className="alert-danger"
                    message={this.state.errorMessage}
                    onClose={() => { this.setState({ errorMessage: null }); }}
                />

                <Switch>
                    <Route path="/timeline">
                        <TimelineView config={this.state.config} onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/modules">
                        <RenderModulesView self={this} />
                    </Route>
                    <Route path="/hotspots">
                        <RenderHotspotsView self={this} />
                    </Route>
                    <Route path="/hotspots-structure">
                        <RenderHotspotsStructureView self={this} />
                    </Route>
                    <Route path="/change-coupling">
                        <RenderChangeCouplingView self={this} />
                    </Route>
                    <Route path="/change-coupling-structure">
                        <RenderChangeCouplingStructureView self={this} />
                    </Route>
                    <Route path="/main-developer">
                        <RenderMainDeveloperView self={this} />
                    </Route>
                    <Route path="/main-developer-structure">
                        <RenderMainDeveloperStructureView self={this} />
                    </Route>
                    <Route path="/commit-spread">
                        <CommitSpreadView config={this.state.config} onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/custom-analysis">
                        <CustomAnalysisView onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/configuration">
                        <ConfigurationView
                            config={this.state.config}
                            changeConfig={newConfig => { this.setState({ config: newConfig }); }}
                        />
                    </Route>
                    <Route path="/">
                        <HomeView onError={error => { this.setError(error); }} />
                    </Route>
                </Switch>
            </main>
        );
    }

    setError(error: any) {
        this.setState({ errorMessage: getErrorMessage(error) });
    }

    fetchAutoCompletionFiles() {
        axios.get(`/api/file`)
            .then(response => {
                this.setState({
                    autoCompletionFiles: response.data.map(file => file.name)
                });
            })
            .catch(error => {
                this.setState(error);
            });
    }

    fetchAutoCompletionModules() {
        axios.get(`/api/module`)
            .then(response => {
                this.setState({
                    autoCompletionModules: response.data.map(module => module.name)
                });
            })
            .catch(error => {
                this.setState(error);
            });
    }
}

function RenderModulesView({ self }: { self: ApplicationMain }) {
    return (
        <ModulesView
            config={self.state.config}
            initialBreakdownType={getTypeFromHash(
                useLocation().hash,
                new Map([["code", ModulesBreakdownType.CodeLines], ["complexity", ModulesBreakdownType.Complexity]])
            )}
            onError={error => { self.setError(error); }}
        />
    )
}

function RenderHotspotsView({ self }: { self: ApplicationMain }) {
    return (
        <HotspotsView
            config={self.state.config}
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    )
}

function RenderHotspotsStructureView({ self }: { self: ApplicationMain }) {
    return (
        <HotspotsStructureView
            config={self.state.config}
            initialAnalysisType={getTypeFromHash(
                useLocation().hash,
                new Map([["revision", HotspotsAnalysisType.Revision], ["author", HotspotsAnalysisType.Author]])
            )}
            onError={error => { self.setError(error); }}
        />
    )
}

function RenderChangeCouplingView({ self }: { self: ApplicationMain }) {
    return (
        <ChangeCouplingView
            config={self.state.config}
            autoCompletionFiles={self.state.autoCompletionFiles}
            autoCompletionModules={self.state.autoCompletionModules}
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    );
}

function RenderChangeCouplingStructureView({ self }: { self: ApplicationMain }) {
    return (
        <ChangeCouplingStructureView
            config={self.state.config}
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    );
}

function RenderMainDeveloperView({ self }: { self: ApplicationMain }) {
    return (
        <MainDeveloperView
            config={self.state.config}
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    );
}

function RenderMainDeveloperStructureView({ self }: { self: ApplicationMain }) {
    return (
        <MainDeveloperStructureView
            config={self.state.config}
            onError={error => { self.setError(error); }}
        />
    );
}

function getEntryType(hash: string) {
    return getTypeFromHash(
        hash,
        new Map([["file", EntryType.File], ["module", EntryType.Module]])
    );
}

function getTypeFromHash<T>(hash: string, values: Map<string, T>): T {
    let hashParts = hash.split("#");
    if (hashParts.length == 2) {
        return values.get(hashParts[1]) ?? null;
    } else {
        return null;
    }
}

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

type Children = (string | JSX.Element)[];

function RenderLink({ to, children }: { to: string; children: Children }) {
    const { pathname } = useLocation();

    return (
        <Link className={`nav-link d-flex align-items-center gap-2 ${to == pathname ? "active" : ""}`} to={to}>
            {children}
        </Link>
    );
}

function RenderDualLink({ to1, to2, children, secondaryLink }: { to1: string; to2: string; children: Children, secondaryLink: JSX.Element }) {
    const { pathname } = useLocation();
    const selectedColor = "#2470dc";

    return (
        <span className={`nav-link d-flex align-items-center gap-2`} >
            <Link
                to={to1} style={{ textDecoration: "none", color: (to1 == pathname || to2 == pathname) ? selectedColor : null }}
                className="d-flex align-items-center gap-2"
            >
                {children}
            </Link>
            <Link to={to2} style={{ color: to2 == pathname ? selectedColor : null }}>{secondaryLink}</Link>
        </span>
    );
}

ReactDOM.render(
    <ApplicationMain/>,
    document.getElementById("root")
);

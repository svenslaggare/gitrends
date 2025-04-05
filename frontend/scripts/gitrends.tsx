import React, {useEffect} from "react";
import ReactDOM from 'react-dom'

import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    useLocation
} from "react-router-dom";

import {ChangeCouplingView} from "./views/changeCoupling";
import {HotspotView} from "./views/hotspot";
import {HotspotStructureView} from "./views/hotspotStructure";
import {AlertBox, EntryType} from "./viewHelpers";
import {getErrorMessage} from "./helpers";
import {TimelineView} from "./views/timeline";
import {ChangeCouplingStructureView} from "./views/changeCouplingStructure";

interface ApplicationMainProps {

}

interface ApplicationMainState {
    errorMessage: string
}

class ApplicationMain extends React.Component<ApplicationMainProps, ApplicationMainState> {
    constructor(props) {
        super(props);

        this.state = {
            errorMessage: null
        };
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
                <a className="navbar-brand col-md-3 col-lg-2 me-0 px-3 fs-6 text-white" href="#">Gitrends</a>

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
                            <RenderDualLink
                                to1={"/hotspots"}
                                to2={"/hotspots-structure"}
                                secondaryLink={<i className="fa-solid fa-sitemap"/>}
                            >
                                <i className="fa-solid fa-fire"/>
                                Hotspots
                            </RenderDualLink>
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
                                <RenderLink to="/timeline">
                                    <i className="fa-solid fa-timeline" />
                                    Timeline
                                </RenderLink>
                            </li>
                        </ul>

                        <hr className="my-3"/>

                        <ul className="nav flex-column mb-auto">
                            <li className="nav-item">
                                <a className="nav-link d-flex align-items-center gap-2" href="#">
                                    Settings
                                </a>
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
                    <Route path="/hotspots-structure">
                        <HotspotStructureView onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/hotspots">
                        <RenderHotspotView self={this} />
                    </Route>
                    <Route path="/change-coupling">
                        <RenderChangeCouplingView self={this} />
                    </Route>
                    <Route path="/change-coupling-structure">
                        <ChangeCouplingStructureView onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/timeline">
                        <TimelineView onError={error => { this.setError(error); }} />
                    </Route>
                    <Route path="/">
                        <HotspotStructureView onError={error => { this.setError(error); }} />
                    </Route>
                </Switch>
            </main>
        );
    }

    setError(error: any) {
        this.setState({ errorMessage: getErrorMessage(error) });
    }
}

function RenderHotspotView({ self }: { self: ApplicationMain }) {
    return (
        <HotspotView
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    )
}

function RenderChangeCouplingView({ self }: { self: ApplicationMain }) {
    return (
        <ChangeCouplingView
            initialEntryType={getEntryType(useLocation().hash)}
            onError={error => { self.setError(error); }}
        />
    );
}

function getEntryType(hash: string) {
    let hashParts = hash.split("#");
    if (hashParts.length == 2) {
        switch (hashParts[1]) {
            case "file":
                return EntryType.File;
            case "module":
                return EntryType.Module;
            default:
                return null;
        }
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

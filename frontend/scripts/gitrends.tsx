import React, {JSX, useEffect} from "react";
import ReactDOM from 'react-dom'

import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    useLocation, useParams
} from "react-router-dom";

import {ChangeCouplingView} from "./views/changeCoupling";
import {HotspotView} from "./views/hotspot";
import {HotspotStructureView} from "./views/hotspotStructure";
import {EntryType} from "./viewHelpers";

interface ApplicationMainProps {

}

interface ApplicationMainState {

}

class ApplicationMain extends React.Component<ApplicationMainProps, ApplicationMainState> {
    constructor(props) {
        super(props);

        this.state = {

        };
    }

    render() {
        return (
            <div>
                {this.renderTopbar()}

                <div className="container-fluid">
                    <div className="row">
                        <Router>
                            <ScrollToTop />

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
                            <li className="nav-item">
                                <RenderLink to="/hotspots-structure">
                                    <i className="fa-solid fa-sitemap" />
                                    Hotspots structure
                                </RenderLink>
                            </li>
                            <li className="nav-item">
                                <RenderLink to="/hotspots">
                                    <i className="fa-solid fa-fire" />
                                    Hotspots
                                </RenderLink>
                            </li>
                            <li className="nav-item">
                                <RenderLink to="/change-coupling">
                                    <i className="fa-solid fa-link" />
                                    Change coupling
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
                <Switch>
                    <Route path="/hotspots-structure">
                        <HotspotStructureView />
                    </Route>
                    <Route path="/hotspots">
                        <RenderHotspotView />
                    </Route>
                    <Route path="/change-coupling">
                        <RenderChangeCouplingView />
                    </Route>
                    <Route path="/">
                        <HotspotStructureView />
                    </Route>
                </Switch>
            </main>
        );
    }
}

function RenderHotspotView() {
    return <HotspotView initialEntryType={getEntryType(useLocation().hash)} />;
}

function RenderChangeCouplingView() {
    return <ChangeCouplingView initialEntryType={getEntryType(useLocation().hash)} />;
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

function getErrorMessage(error) {
    if (error.response !== undefined) {
        return error.response.data.message;
    } else {
        return "Failed to send request.";
    }
}

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

function RenderLink({ to, children }: { to: string; children: (string | JSX.Element)[] }) {
    const { pathname } = useLocation();

    return (
        <Link className={`nav-link d-flex align-items-center gap-2 ${to == pathname ? "active" : ""}`} to={to}>
            {children}
        </Link>
    );
}

ReactDOM.render(
    <ApplicationMain />,
    document.getElementById("root")
);

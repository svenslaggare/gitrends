export interface AppConfig {
    hotspotsMaxEntries: number;

    changeCouplingMaxEntries: number;

    mainDeveloperMaxEntries: number;
    mainDeveloperHistogramMaxDevelopers: number;
    mainDeveloperHistogramNormalized: boolean;

    mainDeveloperStructureMaxDevelopers: number;

    commitSpreadMaxAuthors: number;
    commitSpreadMinNumModuleCommits: number;
}

export const DEFAULT_CONFIG: AppConfig = {
    hotspotsMaxEntries: 100,

    changeCouplingMaxEntries: 100,

    mainDeveloperMaxEntries: 100,
    mainDeveloperHistogramMaxDevelopers: 9,
    mainDeveloperHistogramNormalized: true,

    mainDeveloperStructureMaxDevelopers: 9,

    commitSpreadMaxAuthors: 13,
    commitSpreadMinNumModuleCommits: 10,
};

export function persistConfig(config: AppConfig) {
    localStorage.setItem("config", JSON.stringify(config));
}

export function loadPersistedConfig() {
    try {
        let content = localStorage.getItem("config");
        let config: AppConfig = JSON.parse(content);

        for (let [key, value] of Object.entries(DEFAULT_CONFIG)) {
            if (config[key] == undefined) {
                config[key] = value;
            }
        }

        return config;
    } catch (e) {
        return DEFAULT_CONFIG;
    }
}
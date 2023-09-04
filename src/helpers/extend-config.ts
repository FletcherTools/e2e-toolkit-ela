export function extendConfig<T>(baseConfig: T, userConfig: Partial<T>): T {
    const config = JSON.parse(JSON.stringify(userConfig));
    return Object.assign({}, baseConfig, config)
}

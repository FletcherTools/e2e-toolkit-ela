const keysMap = {
    ctrlKey: 'ctrl',
    shiftKey: 'shift',
    altKey: 'alt'
};

export function getShortcutByEvent(e: KeyboardEvent): string {
    const key = e.keyCode > 18 ? e.code.replace(/^Key/, '') : '';
    const specialPart = Object.entries(keysMap)
        .reduce((result, [key, name]) =>
            // @ts-expect-error: minor
            e[key] ? result.concat(name) : result,
            [] as any
        )

    return [...specialPart, key].filter(Boolean)
        .join('+')
        .toUpperCase();
}
import './ela.scss';

import * as $ from 'jquery';
import { extendConfig, getShortcutByEvent } from './helpers';

const HELPER_ACTIVE_CLASS = 'ela-active';
const TOOLTIP_INVERTED_CLASS = 'ela-inverted';
const UPDATE_SERVICE_ATTRS_INTERVAL = 3000;

const TEST_ID_ATTR = 'data-test-id';
const TEST_PARAMS_ATTR = 'data-test-params';
const PSEUDO_ID_ATTR = 'data-test-pseudo-id';
const PSEUDO_NAME_ATTR = 'data-test-pseudo-name';

export interface ELAConfig {
    customSelectorPrefix: string
    pseudoSelectorPrefix: string
    activateShortcut: string
    relocateShortcut: string
    pseudoSelectorMap: Record<string, string>
}

const defaultConfig: ELAConfig = {
    customSelectorPrefix: '%',
    pseudoSelectorPrefix: '%%',
    activateShortcut: 'ctrl+alt+l',
    relocateShortcut: 'ctrl+alt+p',
    pseudoSelectorMap: {}
};

export function ELAComponent(userConfig: ELAConfig) {
    const config = extendConfig(defaultConfig, userConfig);
    const {customSelectorPrefix, pseudoSelectorPrefix, pseudoSelectorMap} = config;
    let attachInterval;

    document.addEventListener('keydown', onKeyDown);
    document.body.style.setProperty('--custom-prefix', `'${customSelectorPrefix}'`)
    document.body.style.setProperty('--pseudo-prefix', `'${pseudoSelectorPrefix}'`)

    return function destroy() {
        onHelperToggle(false);
        document.removeEventListener('keydown', onKeyDown);
    }

    ///

    function onKeyDown(e: KeyboardEvent) {
        const shortcut = getShortcutByEvent(e);

        switch (shortcut) {
            case config.activateShortcut.toUpperCase():
                onHelperToggle();
                break;
            case config.relocateShortcut.toUpperCase():
                onTooltipPositionToggle();
                break;
        }
    }

    function onHelperToggle(value = !document.body.classList.contains(HELPER_ACTIVE_CLASS)) {
        if (value) {
            document.body.classList.add(HELPER_ACTIVE_CLASS);
            document.addEventListener('click', onGlobalClick);
            attachInterval = setInterval(attachServiceAttrs, UPDATE_SERVICE_ATTRS_INTERVAL);
            attachServiceAttrs();
        } else {
            document.body.classList.remove(HELPER_ACTIVE_CLASS);
            document.removeEventListener('click', onGlobalClick);
            clearInterval(attachInterval);
        }
    }

    function onTooltipPositionToggle() {
        document.body.classList.toggle(TOOLTIP_INVERTED_CLASS);
    }

    function onGlobalClick(event) {
        const targetEl = event.target;
        if (targetEl?.hasAttribute(TEST_ID_ATTR) || targetEl?.hasAttribute(PSEUDO_ID_ATTR)) {
            event.preventDefault();
            event.stopPropagation();

            if (event.ctrlKey) { // copy full pseudo-path if ctrl is pressed
                const isPseudo = targetEl.hasAttribute(PSEUDO_ID_ATTR);
                const parents = $(targetEl).parents()
                    .filter((i, parentEl) => (
                        parentEl.hasAttribute(TEST_ID_ATTR) ||
                        isPseudo && parentEl.hasAttribute(PSEUDO_ID_ATTR)
                    ))
                    .toArray();

                const pseudoQuery = [...parents.reverse(), targetEl]
                    .map(el => extractPseudoSelector(el))
                    .join(' ');

                copyToClipboard(pseudoQuery);
            } else {
                const pseudoSelector = extractPseudoSelector(targetEl);
                copyToClipboard(pseudoSelector);
            }
        }
    }

    ///

    function attachServiceAttrs() {
        attachPseudoAttrs();
        attachParamsAttrs();
    }

    function attachPseudoAttrs() {
        for (let pseudoSelector in pseudoSelectorMap) {
            const rawSelector = pseudoSelectorMap[pseudoSelector];
            const selector = rawSelector.replace(/=?\$name/gi, '');
            const pseudoId = pseudoSelector.replace(/=\$name/gi, '');

            $(selector).each((index, el) => {
                el.setAttribute(PSEUDO_ID_ATTR, pseudoId);
                if (rawSelector.includes('$name') && !el.hasAttribute(PSEUDO_NAME_ATTR)) {
                    setPseudoNameAttr(el, selector);
                }
                if (!el.hasAttribute(TEST_PARAMS_ATTR)) {
                    setTestParamsAttr(el);
                }
            });
        }
    }

    function attachParamsAttrs(): void {
        const elements = $(`[${TEST_ID_ATTR}]`).toArray();
        for (let el of elements) {
            if (el.hasAttribute(TEST_PARAMS_ATTR)) continue;
            setTestParamsAttr(el);
        }
    }

    function setPseudoNameAttr(el: HTMLElement, selector: string): void {
        switch (true) {
            case selector.includes(':contains()'): {
                const universalSelector = selector
                    .replace(':contains()', '')
                    .replace(':has', ' :is');

                const [targetEl] = $(universalSelector).toArray();
                const containedText = (targetEl ?? el).textContent.trim().replace(/\s+/g, ' ');
                const name = `"${containedText}"`;

                el.setAttribute(PSEUDO_NAME_ATTR, name);
                break;
            }
            case /\[[a-z0-9_\-]+\]$/.test(selector): {
                const [,nameAttr] = /\[([a-z0-9_\-]+)\]$/.exec(selector)
                const name = `"${el.getAttribute(nameAttr)}"`;
                el.setAttribute(PSEUDO_NAME_ATTR, name);
                break;
            }
        }
    }

    function setTestParamsAttr(el: HTMLElement): void {
        const paramsList = el.getAttributeNames()
            .map(attrName => /^data-test-(?<paramName>.+)-spec$/.exec(attrName))
            .filter(Boolean)
            .map((match) => `${match.groups.paramName}=${el.getAttribute(match.input)}`);

        if (paramsList.length) {
            el.setAttribute(TEST_PARAMS_ATTR, `%(${paramsList.join(',')})`);
        }
    }

    function extractPseudoSelector(el: HTMLElement): string {
        const {content} = window.getComputedStyle(el, '::before');
        return content.slice(1, -1).replace(/\\/g, '');
    }

    function copyToClipboard(text: string): void {
        navigator.clipboard?.writeText(text);
    }
}

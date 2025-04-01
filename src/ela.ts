import './ela.scss';

// @ts-ignore
import jQuery from 'jquery';
import { extendConfig, getShortcutByEvent } from './helpers';

const HELPER_ACTIVE_CLASS = 'ela-active';
const TOOLTIP_INVERTED_CLASS = 'ela-inverted';
const FROZEN_CLASS = 'ela-frozen';
const PSEUDO_HOVERED_CLASS = 'ela-pseudo';
const UPDATE_SERVICE_ATTRS_INTERVAL = 3000;

const TEST_ID_ATTR = 'data-test-id';
const TEST_PARAMS_ATTR = 'data-test-params';
const PSEUDO_ID_ATTR = 'data-test-pseudo-id';
const PSEUDO_NAME_ATTR = 'data-test-pseudo-name';

const FREEZE_KEY = navigator.platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';
const SHOW_NESTED_KEY = 'Shift';
const SHOW_PARAMS_KEY = 'Alt';

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

    let panelEl: HTMLElement;
    let hoveredElement: HTMLElement;
    let attachInterval: number;

    let showNested: boolean;
    let showParams: boolean;
    let isFrozen: boolean;

    document.addEventListener('keydown', onKeyDown);

    return function destroy() {
        onHelperToggle(false);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('mouseover', onHover);
        panelEl?.remove();
    }

    // Handlers

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
            document.addEventListener('mouseover', onHover);
            document.addEventListener('keydown', onKeyPress);
            document.addEventListener('keyup', onKeyPress);

            attachInterval = setInterval(attachServiceAttrs, UPDATE_SERVICE_ATTRS_INTERVAL) as unknown as number;
            attachServiceAttrs();

            panelEl = jQuery('<div class="ela-panel" />')[0];
            jQuery('body').append(panelEl);

        } else {
            document.body.classList.remove(HELPER_ACTIVE_CLASS);
            document.removeEventListener('click', onGlobalClick);
            document.removeEventListener('mouseover', onHover);
            document.removeEventListener('keydown', onKeyPress);
            document.removeEventListener('keyup', onKeyPress);
            clearInterval(attachInterval);
            panelEl?.remove();
        }
    }

    function onKeyPress(e: KeyboardEvent) {
        // console.warn('onKeyPress', e, hoveredElement);
        switch (e.key) {
            case SHOW_NESTED_KEY: {
                showNested = e.type === 'keydown';
                if (hoveredElement) panelEl.innerText = getSelector(hoveredElement, showNested, showParams);
                break;
            }
            case SHOW_PARAMS_KEY: {
                showParams = e.type === 'keydown';
                if (hoveredElement) panelEl.innerText = getSelector(hoveredElement, showNested, showParams);
                break;
            }
            case FREEZE_KEY: {
                isFrozen = e.type === 'keydown';
                document.body.classList.toggle(FROZEN_CLASS, e.type === 'keydown');
                break;
            }
        }
    }

    function onTooltipPositionToggle() {
        document.body.classList.toggle(TOOLTIP_INVERTED_CLASS);
    }

    function onHover(e: MouseEvent) {
        hoveredElement = e.target?.closest(`[${TEST_ID_ATTR}],[${PSEUDO_ID_ATTR}]`);

        if (hoveredElement) {
            // console.log('hovered', hoveredElement);
            panelEl.innerText = getSelector(hoveredElement, showNested, showParams);
            panelEl.classList.toggle(PSEUDO_HOVERED_CLASS, Boolean(hoveredElement.getAttribute(PSEUDO_ID_ATTR)));
        } else {
            panelEl.innerText = '';
            panelEl.classList.toggle(PSEUDO_HOVERED_CLASS, false);
        }
    }

    function onGlobalClick(event: MouseEvent) {
        if (!hoveredElement) return;
        if (!isFrozen) return;

        event.preventDefault();
        event.stopPropagation();

        const selector = getSelector(hoveredElement, showNested, showParams);;
        copyToClipboard(selector);
    }

    ///

    function attachServiceAttrs() {
        attachParamsAttrs();
        attachPseudoAttrs();

        ///

        function attachPseudoAttrs() {
            for (let pseudoSelector in pseudoSelectorMap) {
                const rawSelector = pseudoSelectorMap[pseudoSelector];
                const selector = rawSelector.replace(/=?\$name/gi, '');
                const pseudoId = pseudoSelector.replace(/=\$name/gi, '');

                jQuery(selector).each((index, el) => {
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
            const elements = jQuery(`[${TEST_ID_ATTR}]`).toArray();
            for (let el of elements) {
                if (el.hasAttribute(TEST_PARAMS_ATTR)) continue;
                setTestParamsAttr(el);
            }
        }

        function setPseudoNameAttr(el: HTMLElement, selector: string): void {
            const innerSelector = selector
              .replace(':has', ' :is')
              .replace(/^[^\s]+\s/, '');

            switch (true) {
              /* Name from Text Content */
                case selector.includes(':contains()'): {
                    const targetSelector = innerSelector.replaceAll(':contains()', '');
                    const [targetEl] = targetSelector ? jQuery(el).find(targetSelector).toArray() : [el];
                    const containedText = (targetEl ?? el).textContent.trim().replace(/\s+/g, ' ');
                    const name = `"${containedText}"`;

                    el.setAttribute(PSEUDO_NAME_ATTR, name);
                    break;
                }
              /* Name from an Attr */
                case selector.includes('['): {
                    const foundEls = innerSelector ? jQuery(el).find(innerSelector).toArray() : [el];
                    const [,nameAttr] = /\[([a-z0-9_\-]+)\]/.exec(innerSelector)
                    const name = foundEls.map(targetEl => `"${targetEl.getAttribute(nameAttr)}"`).join('|')

                    el.setAttribute(PSEUDO_NAME_ATTR, name);
                    break;
                }
            }
        }

        function setTestParamsAttr(el: HTMLElement): void {
            let paramsList = el.getAttributeNames()
              .map(attrName => /data-test-(?<paramName>.+)/.exec(attrName))
              .filter(Boolean)
              .filter(match => match!.input !== 'data-test-id')
              .filter(match => !match!.input.endsWith('-spec'))
              // .map(match => (console.log(match), match))
              .map((match) => `${match!.groups!.paramName}=${el.getAttribute(match!.input)}`)

            if (paramsList.length) {
                el.setAttribute(TEST_PARAMS_ATTR, `${customSelectorPrefix}(${paramsList.join(',')})`);
            }
        }
    }

    // Helpers

    function getSelector(targetEl: HTMLElement, showNested: boolean, showParams: boolean) {
        return showNested
            ? buildNestedSelector(targetEl, showParams)
            : buildSelector(targetEl, showParams);

        function buildNestedSelector(targetEl: HTMLElement, showParams?: boolean) {
            const isPseudo = targetEl.hasAttribute(PSEUDO_ID_ATTR);
            const parents = jQuery(targetEl).parents()
              .filter((i, parentEl) => (
                parentEl.hasAttribute(TEST_ID_ATTR) ||
                isPseudo && parentEl.hasAttribute(PSEUDO_ID_ATTR)
              ))
              .toArray();

            return [...parents.reverse(), targetEl]
              .map(el => buildSelector(el, showParams))
              .join(' ');
        }

        function buildSelector(el: HTMLElement, showParams?: boolean): string {
            const testId = el.getAttribute(TEST_ID_ATTR);
            const testParams = el.getAttribute(TEST_PARAMS_ATTR);
            const pseudoId = el.getAttribute(PSEUDO_ID_ATTR);
            const pseudoName = el.getAttribute(PSEUDO_NAME_ATTR);

            if (pseudoId) {
                return pseudoName
                  ? `${pseudoSelectorPrefix}(${pseudoId}=${pseudoName})`
                  : `${pseudoSelectorPrefix}${pseudoId}`;
            }

            return `${customSelectorPrefix}${testId}` + (showParams && testParams ? `${testParams}` : '');
        }
    }

    function copyToClipboard(text: string): void {
        console.log('Copied', text);
        navigator.clipboard?.writeText(text);
    }
}

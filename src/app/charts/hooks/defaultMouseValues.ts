import type {UseMouseValues} from "./useMouse";

/**
 * No operation function for use when a default function is needed
 */
const noop = () => {
    /* empty on purpose */
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultMouseValues = (): UseMouseValues<any, any> => ({
    registerMouseOverHandler: () => '',
    unregisterMouseOverHandler: noop,
    mouseOverHandlerFor: () => undefined,
    registerMouseLeaveHandler: () => '',
    unregisterMouseLeaveHandler: noop,
    mouseLeaveHandlerFor: () => undefined,
})
import {defaultMouseValues} from "./defaultMouseValues";

describe('defaultMouseValues', () => {
    const values = defaultMouseValues<unknown, unknown>();

    it('should register handlers as no-ops returning an empty handler id', () => {
        expect(values.registerMouseOverHandler('id', () => {})).toBe('');
        expect(values.registerMouseLeaveHandler('id', () => {})).toBe('');
    });

    it('should return undefined for any handler lookup', () => {
        expect(values.mouseOverHandlerFor('id')).toBeUndefined();
        expect(values.mouseLeaveHandlerFor('id')).toBeUndefined();
    });

    it('should not throw when unregistering', () => {
        expect(() => values.unregisterMouseOverHandler('id')).not.toThrow();
        expect(() => values.unregisterMouseLeaveHandler('id')).not.toThrow();
    });
});

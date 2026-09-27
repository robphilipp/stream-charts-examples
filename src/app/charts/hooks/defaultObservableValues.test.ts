import {defaultObservableValues} from "./defaultObservableValues";
import type {ChartData} from "../observables/ChartData";

describe('defaultObservableValues', () => {
    const values = defaultObservableValues<ChartData, unknown>();

    it('should default windowingTime to NaN', () => {
        expect(values.windowingTime).toBeNaN();
    });

    it('should default shouldSubscribe to false', () => {
        expect(values.shouldSubscribe).toBe(false);
    });

    it('should not throw when the onSubscribe/onUnsubscribe callbacks are called', () => {
        // onSubscribe is a no-op that ignores its (required) Subscription argument at runtime;
        // cast bypasses the type only for this call, to confirm that runtime behavior
        expect(() => (values.onSubscribe as () => void)()).not.toThrow();
        expect(() => values.onUnsubscribe?.()).not.toThrow();
    });
});

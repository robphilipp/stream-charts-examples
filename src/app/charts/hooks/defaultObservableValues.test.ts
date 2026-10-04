import {defaultObservableValues} from "./defaultObservableValues";

describe('defaultObservableValues', () => {
    const values = defaultObservableValues();

    it('should default windowingTime to NaN', () => {
        expect(values.windowingTime).toBeNaN();
    });
});

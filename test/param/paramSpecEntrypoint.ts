import * as specs from './parameterizedSpecs';
let ctx;
export function parameterizedSpecs(type){
    ctx = specs.successWithModerateSetting(undefined, type);
    let specKeys = Object.keys(specs);
    specKeys.shift(); // remove initial spec as we've called it above
    specKeys.map(specName=> ctx = specs[specName](ctx, type) ); // run spec with context and override ctx
    return ctx;
}


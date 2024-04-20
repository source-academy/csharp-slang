abstract class AbstractExternalLibrary {
    protected functions : Record<string, Function>;
    
    constructor() {
        this.functions = {};
    }

    getFunction(functionIdentifier : string) : Function | null {
        const result = this.functions[functionIdentifier];
        if(result === undefined) {
            return null;
        }
        return result;
    }
}

export { AbstractExternalLibrary };


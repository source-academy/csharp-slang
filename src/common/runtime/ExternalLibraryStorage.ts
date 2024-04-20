import { RuntimeCILError } from "../CSInterpreterError";
import { AbstractExternalLibrary } from "./externalLibraries/AbstractExternalLibrary";
import { NativeLibrary } from "./externalLibraries/NativeLibrary";

class ExternalLibraryStorage {
    private externalLibraries : Record<string, AbstractExternalLibrary>;

    constructor() {
        this.externalLibraries = {};
        this.addExternalLibrary("NativeLibrary", new NativeLibrary());
    }

    private addExternalLibrary(name : string, library : AbstractExternalLibrary) {
        this.externalLibraries[name] = library;
    }

    getFunction(libraryName : string, functionIdentifier : string) : Function {
        const library = this.externalLibraries[libraryName];
        if(library === undefined) {
            throw new RuntimeCILError("No external library named [" + libraryName + "]");
        }
        const result = library.getFunction(functionIdentifier);
        if(result === null) {
            throw new RuntimeCILError("Cannot find function [" + functionIdentifier + "] in external library [" + libraryName + "]");
        }
        return result;
    }
}



export { ExternalLibraryStorage };
import { type ClassMetadata } from '../compileTime/metadata/ClassMetadata'

type CILLocalName = string

/**
 * A class that represents a local in CIL runtime environment.
 */
class CILLocal {
  /**
   * The type of the local.
   */
  readonly type: ClassMetadata
  /**
   * The name of the local.
   */
  readonly name: CILLocalName

  /**
   * @param type The type of the local.
   * @param name The name of the local.
   */
  constructor (type: ClassMetadata, name: CILLocalName) {
    this.type = type
    this.name = name
  }
}

export { CILLocal, type CILLocalName }

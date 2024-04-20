import { NameBindingError } from '../CSInterpreterError'
import { type ClassMetadata } from './metadata/ClassMetadata'
import { assertTrue } from '../../util/Assertion'

/**
 * An abstract class that represents a compile-time scope.
 */
abstract class Scope {
  /**
   * All name bindings that are directly in this scope.
   */
  readonly nameBindings: Record<string, NameBinding>
  /**
   * The parent scope for this scope.
   */
  parent: Scope | null
  /**
   * All child scopes for this scope.
   */
  readonly childScopes: Scope[]
  /**
   * The index of the code piece that has the code of this scope.
   *
   * This property is for finding classes with the "using" statements from the code piece that this scope belongs to.
   */
  readonly codePieceIndex: number

  /**
   * The constructor for the `Scope` class.
   *
   * @param codePieceIndex The index of the code piece that has the code of this scope.
   */
  constructor (codePieceIndex: number) {
    this.nameBindings = {}
    this.childScopes = []
    this.parent = null
    this.codePieceIndex = codePieceIndex
  }

  public getBindingByNameLocally (name: string): NameBinding | null {
    const result = this.nameBindings[name]
    if (result === undefined) {
      return null
    }
    return result
  }

  /**
   * Lookup a binded value by its name and type from this scope to its ancestor scopes and until to the root scope. An `NameBindingError` will be thrown when the binding with the specified name and type cannot be found.
   *
   * @param name The name of the binding.
   * @param type The type of the binding, can be either a `ClassMetadata` or an option in `InternalBindingType`.
   * @returns The binded value.
   */
  lookupValueByNameAndType (name: string, type: ClassMetadata | InternalBindingType | undefined = undefined): any {
    const resultFromThisScope = this.getBindingByNameLocally(name)
    if (resultFromThisScope !== null) {
      if (type === undefined || resultFromThisScope.type === type) {
        return resultFromThisScope.value
      }
    }
    if (this.parent === null) {
      throw new NameBindingError(name, 'NotFound')
    }
    return this.parent.lookupValueByNameAndType(name, type)
  }

  /**
   * Add a child scope into this `Scope`.
   *
   * @newChild The child scope that will be added.
   */
  addChildScope (newChild: Scope): void {
    assertTrue(newChild.parent === null)
    assertTrue(!this.childScopes.includes(newChild))
    this.childScopes[this.childScopes.length] = newChild
    newChild.parent = this
  }

  /**
   * Add a new name binding with its type, namd and value to the current scope.
   *
   * There can not exists two name bindings with the same name directly in the same scope.
   *
   * @param type The type of the binding, can be either a `ClassMetadata` or an option in `InternalBindingType`.
   * @param name The name of the binding.
   * @param value The initial binded value.
   */
  addNameBinding (type: ClassMetadata | InternalBindingType, name: string, value: any): void {
    if (this.getBindingByNameLocally(name) !== null) {
      throw new NameBindingError(name, 'DuplicatedName')
    }
    this.nameBindings[name] = new NameBinding(type, name, value)
  }
}

/**
 * The internal binding types.
 */
enum InternalBindingType {
  Class,
  Method,
}

class NameBinding {
  readonly name: string
  readonly type: ClassMetadata | InternalBindingType
  value: any

  constructor (type: ClassMetadata | InternalBindingType, name: string, value: any) {
    this.name = name
    this.value = value
    this.type = type
  }
}

export { Scope, InternalBindingType }

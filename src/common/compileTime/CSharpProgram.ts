import { log } from '../../util/Logger'
import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from '../../util/Assertion'
import { MetadataStorage } from './metadata/MetadataStorage'
import { ClassMetadata } from './metadata/ClassMetadata'
import { NamespaceMetadata } from './metadata/NamespaceMetadata'
import { type TypeSpecifier } from './TypeSpecifier'
import { TypePath } from './TypePath'
import { OBJECT_CLASS_PATH_AND_NAME } from '../Constants'
import { CSRuleError, DuplicatedCodePieceNameError, NotSupportedError } from '../CSInterpreterError'
import { InheritanceTree } from './InheritanceTree'
import { type Scope } from './Scope'
import { type CILTypePath } from '../cil/CILMethodBody'

type UsingNamespacePath = string

/**
 * A class that represents a C# program.
 */
class CSharpProgram {
  private compileStage: CompileStage
  private allTypeSpecifiers: TypeSpecifier[]
  private allClasses: ClassMetadata[]
  private inheritanceTree: InheritanceTree
  private currentCodePieceIndex: number
  /**
   * All code pieces in this C# program.
   */
  readonly codePieces: CodePiece[]
  /**
   * The metadata for this C# program.
  */
  readonly metadata: MetadataStorage

  constructor () {
    this.codePieces = []
    this.compileStage = CompileStage.AddingCodePieces
    this.allTypeSpecifiers = []
    this.allClasses = []
    this.metadata = new MetadataStorage()
    this.currentCodePieceIndex = -1
  }

  /**
   * Add a code piece to the program.
   *
   * When calling this method, this program must haven't been compiled.
   *
   * @param pieceName The **unique** name for the code piece in this program.
   * @param rawCode The raw C# code in string.
   */
  addCodePiece (pieceName: string, rawCode: string): void {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    this.checkNewCodePieceName(pieceName)
    this.currentCodePieceIndex = this.codePieces.length
    const newCodePiece = new CodePiece(pieceName)
    this.codePieces[this.currentCodePieceIndex] = newCodePiece
    newCodePiece.usings = this.metadata.addCodeToMetadataAndGetUsings(rawCode)
  }

  /**
   * Compile the program.
   *
   * When calling this method, this program must haven't been compiled.
   */
  compile (): void {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    this.compileStage = CompileStage.MatchTypeSpecifiers
    this.compile_matchTypeSpecifiersWithClasses()
    this.compileStage = CompileStage.PostProcessClassMetadata
    this.compile_postProcessClassMetadata()
    this.compileStage = CompileStage.GenerateInheritanceTree
    this.compile_generateInheritanceTree()
    this.compileStage = CompileStage.ProcessClassInheritanceInfomation
    this.compile_processClassInheritanceInformation()
    this.compileStage = CompileStage.Complete
  }

  /**
   * Get the metadata for a class by full class path.
   *
   * @param typePath The full path for the class.
   * @param relatedCodePieceIndex The code piece index for the C# code that needs to perform this action. Used for error reporting.
   *
   * @returns The `ClassMetadata` with the path specified in `typePath`.
   */
  getClassMetadataByFullPath (typePath: TypePath, relatedCodePieceIndex: number): ClassMetadata {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces || this.compileStage === CompileStage.MatchTypeSpecifiers)
    return this.metadata.getClassMetadataByAbsolutePath(typePath, relatedCodePieceIndex)
  }

  /**
   * Get the metadata for a class with CIL type path.
   *
   * @param path The full CIL path for the class.
   *
   * @returns The `ClassMetadata` with the path specified in `path`.
   */
  getClassMetadataByCILTypePath (path: CILTypePath): ClassMetadata {
    assertTrue(this.compileStage === CompileStage.Complete)
    return this.metadata.getClassMetadataByCILTypePath(path)
  }

  /**
   * @returns "true" if "name" is a name for an outermost namespace
   */
  checkWhetherNameIsOutermostNamespaceName (name: string): boolean {
    return this.metadata.rootNamespace.getChildNamespace(name) !== null
  }

  /**
   * Add a `TypeSpecifier` to the TypeSpecifier array.
   *
   * When calling this method, this program must haven't been compiled.
   *
   * @param typeSpecifier The `TypeSpecifier` to be added into the array.
   */
  addTypeSpecifier (typeSpecifier: TypeSpecifier): void {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    this.allTypeSpecifiers[this.allTypeSpecifiers.length] = typeSpecifier
  }

  /**
   * Add a `ClassMetadata` to the ClassMetadata array and get its index in the array.
   *
   * When calling this method, this program must haven't been compiled.
   *
   * @param classMetadata The `ClassMetadata` to be added into the array.
   * @returns The index of the newly added `ClassMetadata` in the array.
   */
  addClassAndGetIndex (classMetadata: ClassMetadata): number {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    const classMetadataIndex = this.allClasses.length
    this.allClasses[classMetadataIndex] = classMetadata
    return classMetadataIndex
  }

  /**
   * Get a `ClassMetadata` by its index in the ClassMetadata array.
   *
   * When calling this method, this program must have been compiled.
   *
   * @param classMetadataIndex The index for the `ClassMetadata` you want to get from the ClassMetadata array.
   * @returns The `ClassMetadata` in the ClassMetadata array with the index.
   */
  getClassMetadataByIndex (classMetadataIndex: number): ClassMetadata {
    assertTrue(this.compileStage === CompileStage.Complete)
    const classMetadata = this.allClasses[classMetadataIndex]
    assertNonNullOrUndefined(classMetadata)
    return classMetadata
  }

  /**
   * Check whether there is any duplicated class within a scope for a new class.
   *
   * This method can be useful when adding a new class into the scope.
   *
   * When calling this method, this program must haven't been compiled.
   *
   * @param newClassTypePath The `TypePath` for the new class that will be added.
   * @param newClassParent The parent scope for the new class that will be added.
   */
  checkDuplicatedClassDefinition (newClassTypePath: TypePath, newClassParent: Scope): void {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    try {
      this.getClassMetadataByFullPath(newClassTypePath, this.getCurrentCodePieceIndex())
    } catch (e) {
      assertTrue(e.errorID === '0234')
      return
    }
    // assertNonNullOrUndefined(newClass.parent);
    if (newClassParent instanceof NamespaceMetadata) {
      throw new CSRuleError('0101', [newClassParent.fullPathToString_Namespace(), newClassTypePath.typeName], this.getCurrentCodePieceIndex())
    }
    if (newClassParent instanceof ClassMetadata) {
      throw new CSRuleError('0102', [newClassParent.fullPathToString_Class(), newClassTypePath.typeName], this.getCurrentCodePieceIndex())
    }
    assertNotReachHere()
  }

  private compile_matchTypeSpecifiersWithClasses (): void {
    assertTrue(this.compileStage === CompileStage.MatchTypeSpecifiers)
    const len = this.allTypeSpecifiers.length
    for (let i = 0; i < len; i++) {
      const typeSpecifier = this.allTypeSpecifiers[i]
      if (typeSpecifier.matchedClass !== null) {
        continue
      }
      typeSpecifier.matchClass()
    }
  }

  private compile_postProcessClassMetadata (): void {
    assertTrue(this.compileStage === CompileStage.PostProcessClassMetadata)
    const len = this.allClasses.length
    for (let i = 0; i < len; i++) {
      const classMetadata = this.allClasses[i]
      if (classMetadata.postProcessFinished) {
        continue
      }
      classMetadata.postProcess()
    }
  }

  private compile_generateInheritanceTree (): void {
    assertTrue(this.compileStage === CompileStage.GenerateInheritanceTree)
    this.inheritanceTree = new InheritanceTree()
    this.inheritanceTree.buildTree(this.allClasses)
    log('[Compiler] Inheritance tree generated: ')
    log(this.inheritanceTree)
  }

  private compile_processClassInheritanceInformation (): void {
    assertTrue(this.compileStage === CompileStage.ProcessClassInheritanceInfomation)
    this.compile_appendBaseClassFieldsToSubclasses()
    this.compile_generateVirtualMethodTable()
  }

  private compile_appendBaseClassFieldsToSubclasses (): void {
    // For now, I don't support subclasses to have the same field name with their base classes (member hiding).
    // todo: also need to append base class properties to subclasses
    const classCount = this.allClasses.length
    for (let i = 0; i < classCount; i++) {
      const classMetadata = this.allClasses[i]
      this.compile_appendBaseClassFieldsToSubclasses_dfsHelper(classMetadata)
    }
  }

  private compile_appendBaseClassFieldsToSubclasses_dfsHelper (classMetadata: ClassMetadata): void {
    const inheritanceTreeNode = this.inheritanceTree.findNodeByClassMetadata(classMetadata)
    assertTrue(classMetadata === inheritanceTreeNode.classMetadata)
    const inheritanceTreeNodeParent = inheritanceTreeNode.parent
    if (inheritanceTreeNodeParent === null) {
      assertTrue(classMetadata.fullPathToString_Class() === OBJECT_CLASS_PATH_AND_NAME)
      classMetadata.baseClassFieldsAppended = true
      return
    }
    const baseClassMetadata = inheritanceTreeNodeParent.classMetadata
    if (!baseClassMetadata.baseClassFieldsAppended) {
      this.compile_appendBaseClassFieldsToSubclasses_dfsHelper(baseClassMetadata)
    }
    assertTrue(baseClassMetadata.baseClassFieldsAppended)
    const currentClassFieldCount = classMetadata.fields.length
    const checkInheritedFieldHiding = (nameFromBaseClasses: string): void => {
      for (let i = 0; i < currentClassFieldCount; i++) {
        const field = classMetadata.fields[i]
        if (field.fieldName === nameFromBaseClasses) {
          throw new NotSupportedError('Inherited member hiding')
        }
      }
    }
    const baseClassObjectFieldsSize = baseClassMetadata.sizeOfObjectFields
    for (let i = 0; i < currentClassFieldCount; i++) {
      classMetadata.fields[i].fieldOffset += baseClassObjectFieldsSize
    }
    // Is it really needed to use a copied FieldMetadata to append the fields from the base classes to the subclass?
    // Or just can directly append the 'fields' array from the ClassMetadata of the direct base class to the 'fields' array from the ClassMetadata of the subclass (without creating any new 'FieldMetadata')?
    const baseClassFieldCount = baseClassMetadata.fields.length
    for (let i = baseClassFieldCount - 1; i >= 0; i--) { // reversed traverse for using 'unshift' while maintaining the order of base class fields in the 'fields' array of the subclass
      const baseClassField = baseClassMetadata.fields[i]
      const fieldName = baseClassField.fieldName
      checkInheritedFieldHiding(fieldName)
      const newField = baseClassField.getCopy()
      classMetadata.fields.unshift(newField)
    }
    classMetadata.baseClassFieldsAppended = true
  }

  private compile_generateVirtualMethodTable (): void {
    // todo
  }

  /**
   * Get the metadata for a class by class name (type name) and using directives from a specific code piece.
   *
   * @param typeName The class name for the class you want to get metadata for.
   * @param codePieceIndex The index of the code piece that has the using directives you want to use for getting the ClassMetadata.
   *
   * @returns The `ClassMetadata` that is found with `typeName` and a using directive in the code piece with index `codePieceIndex`.
   */
  getClassWithUsingsInCodePiece (typeName: string, codePieceIndex: number): ClassMetadata {
    // Try finding the class under all "using" namespaces in the code piece
    const codePiece = this.codePieces[codePieceIndex]
    const usingCount = codePiece.usings.length
    let latestError = null
    if (usingCount === 0) {
      throw new CSRuleError('-1', ['CSharpProgram.ts/CSharpProgram/getClassWithUsingsInCodePiece'], codePieceIndex)
    }
    for (let i = 0; i < usingCount; i++) {
      const usingNamespace = codePiece.usings[i]
      try {
        return this.getClassMetadataByFullPath(new TypePath(usingNamespace + '.' + typeName), codePieceIndex)
      } catch (e) {
        latestError = e
      }
    }
    if (latestError.errorID === '0234') {
      latestError = new CSRuleError('0246', [latestError.values[0]], codePieceIndex) // Transform the CS0234 error thrown by getClassMetadataByAbsolutePathString to a CS0246 error.
    }
    throw latestError
  }

  /**
   * Get the index for the most-recently-added code piece.
   *
   * If there is no code pieces in this `CSharpProgram`, this method will return `-1`.
   *
   * When calling this method, this program must haven't been compiled.
   *
   * @returns The index for the most-recently-added code piece.
   */
  getCurrentCodePieceIndex (): number {
    assertTrue(this.compileStage === CompileStage.AddingCodePieces)
    return this.currentCodePieceIndex
  }

  /**
   * Similar to `getCurrentCodePieceIndex()`,
   * the only difference between this function and `getCurrentCodePieceIndex()` is that this function will use an assertion to check whether this `CSharpProgram` exists at least one code piece or not (current code piece index should not equals to `-1`).
   *
   * Call this function to get the index for the most-recently-added code piece when you are sure that there must exists at least one code piece in this `CSharpProgram`.
   *
   * @returns The index for the most-recently-added code piece.
   */
  getCurrentCodePieceIndexAssertExistsCodePiece (): number {
    const codePieceIndex = this.getCurrentCodePieceIndex()
    assertTrue(codePieceIndex !== -1)
    return codePieceIndex
  }

  /**
   * Get the name of a code piece by its index.
   *
   * @param codePieceIndex The index of the code piece.
   * @returns the name of the code piece with the index `codePieceIndex`.
   */
  getCodePieceNameByIndex (codePieceIndex: number): string {
    if (codePieceIndex === -1) {
      return '*UnknownCodePiece*'
    }
    assertTrue(codePieceIndex >= 0 && codePieceIndex < this.codePieces.length)
    return this.codePieces[codePieceIndex].name
  }

  private checkNewCodePieceName (pieceName: string): void {
    const len = this.codePieces.length
    for (let i = 0; i < len; i++) {
      if (this.codePieces[i].name === pieceName) {
        throw new DuplicatedCodePieceNameError(pieceName)
      }
    }
  }
}

enum CompileStage {
  AddingCodePieces,
  MatchTypeSpecifiers,
  PostProcessClassMetadata,
  GenerateInheritanceTree,
  ProcessClassInheritanceInfomation,
  Complete,
}

class CodePiece {
  readonly name: string
  usings: UsingNamespacePath[]

  constructor (name: string) {
    this.name = name
  }
}

export { CSharpProgram, type UsingNamespacePath }

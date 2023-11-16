const testcase = 
{
	name: "CS0101 - Duplicated classes in one code piece",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    namespace Namespace2 {
        class A {}
        class A {}
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0101: The namespace 'Namespace1.Namespace2' already contains a definition for 'A'",
}

module.exports = {
    "testcase": testcase
}
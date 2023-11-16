const testcase = 
{
	name: "CS0101 - Duplicated classes in different code pieces",
	codePieces: [
	{
		name: "CodePiece1.cs",
		code:
`
using System;
namespace Namespace1 {
    class A {}
}
`
	},
	{
		name: "CodePiece2.cs",
		code:
`
using System;
namespace Namespace1 {
    class A {}
}
`
	}
	],
	expectedError: "CodePiece2.cs: [C# Interpreter Error] error CS0101: The namespace 'Namespace1' already contains a definition for 'A'",
}

module.exports = {
    "testcase": testcase
}
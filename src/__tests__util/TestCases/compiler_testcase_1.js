const testcase = 
{
	name: "Duplicated code piece names",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;
namespace Namespace1 {}
`
	},
	{
		name: "CodePiece.cs",
		code:
`
using System;
namespace Namespace2 {}
`
	}
	],
	expectedError: "[C# Interpreter Error] A code piece with name 'CodePiece.cs' already exists.",
}

module.exports = {
    "testcase": testcase
}
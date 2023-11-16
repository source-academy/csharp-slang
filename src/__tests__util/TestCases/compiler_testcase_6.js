const testcase = 
{
	name: "CS0111 - Duplicated method signatures in one class",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    namespace Namespace2 {
        class A {
            A Method1(System.String a1, Namespace1.Namespace2.A b1, B c1){
                //
            }
            A Method1(string a2, A b2, B c2){
                //
            }
        }
        class B {}
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0111: A member 'Namespace1.Namespace2.A.Method1(System.String,Namespace1.Namespace2.A,Namespace1.Namespace2.B)' is already defined. Rename this member or use different parameter types",
}

module.exports = {
    "testcase": testcase
}
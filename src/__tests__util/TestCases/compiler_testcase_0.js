const testcase = 
{
	name: "Overall success",
	codePieces: [
	{
		name: "CodePiece1.cs",
		code:
`
using System;

namespace Namespace3 {
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
    namespace Namespace2 {
        class B {
            int a;
            String b;
            Int32 c;
            A Method1(String a, Namespace3.A b, D c){
                //
            }
            A Method1(string a, A b, D c){
                //
            }
        }
       class A : BaseA{
            B Method1(string a, B b, D c){
                //
            }
        }
        //class A{}
        class C{}
        class D{}
        class BaseA{}
       // class B{}
    }
}
`
	},
	{
		name: "CodePiece3.cs",
		code:
`
namespace Namespace1 {
    class A : Namespace1.Namespace2.B {}
    //class A {}
    namespace Namespace2 {
     //   class A{}
    }
}

namespace System {
   // class Object {}
}
`
	}
	],
	expectedError: null,
}

module.exports = {
    "testcase": testcase
}
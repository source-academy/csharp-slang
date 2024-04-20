namespace System {
	public class Object {
		public Object() {}
		public string ToString() {
			return "<" + NativeHelper.GetObjectTypeFullPath(this) + " at address " + NativeHelper.ObjectAddressToInt32(this) + ">";
		}
	}
	public class Console {
		[DllImport("NativeLibrary")]
		private static extern void Native_WriteToStandardOutput(string message);

		/*public static void WriteLine(string content) {
			Console.Write(content + "\n");
		}*/

		public static void Write(object obj) {
			Console.Native_WriteToStandardOutput(obj.ToString());
		}

		public static void WriteLine(object obj) {
			Console.Native_WriteToStandardOutput(obj + "\n");
		}

	}
	public class Type {}

	public class PrimitiveTypeBase {
		public override string ToString() {
			return NativeHelper.PrimitiveObjectToString(this);
		}
	}

	public class Boolean : PrimitiveTypeBase {}
	public class Byte : PrimitiveTypeBase {}
	public class SByte : PrimitiveTypeBase {}
	public class Int16 : PrimitiveTypeBase {}
	public class UInt16 : PrimitiveTypeBase {}
	public class Int32 : PrimitiveTypeBase {}
	public class UInt32 : PrimitiveTypeBase {}
	public class Int64 : PrimitiveTypeBase {}
	public class UInt64 : PrimitiveTypeBase {}
	public class Char : PrimitiveTypeBase {}
	public class Double : PrimitiveTypeBase {}
	public class Single : PrimitiveTypeBase {}
	public class String : PrimitiveTypeBase {
		public static string Concat(string a, string b) {
			return NativeHelper.ConcatenateStrings(a, b);
		}
	}
	public class Decimal : PrimitiveTypeBase {}

	public class NativeHelper {
		[DllImport("NativeLibrary")]
		private static extern string Native_PrimitiveObjectToString(object obj);
		[DllImport("NativeLibrary")]
		private static extern void Native_VirtualMachineDebugBreak();
		[DllImport("NativeLibrary")]
		private static extern void Native_ConcatenateStrings(string first, string second);
		[DllImport("NativeLibrary")]
		private static extern string Native_GetObjectTypeFullPath(object obj);
		[DllImport("NativeLibrary")]
		private static extern string Native_ObjectAddressToInt32(object obj);

		public static string PrimitiveObjectToString(object obj) {
			return NativeHelper.Native_PrimitiveObjectToString(obj);
		}
		
		public static void VirtualMachineDebugBreak() {
			NativeHelper.Native_VirtualMachineDebugBreak();
		}

		public static string ConcatenateStrings(string first, string second) {
			return NativeHelper.Native_ConcatenateStrings(first, second);
		}

		public static string GetObjectTypeFullPath(object obj) {
			return NativeHelper.Native_GetObjectTypeFullPath(obj);
		}

		public static int ObjectAddressToInt32(object obj) {
			return NativeHelper.Native_ObjectAddressToInt32(obj);
		}
	}


	/*class Math {
		[DllImport("NativeLibrary")]
		private static extern string Native_Sine(double x);
		[DllImport("NativeLibrary")]
		private static extern string Native_Cosine(double x);
		[DllImport("NativeLibrary")]
		private static extern string Native_Sqrt(double x);
	}*/
}
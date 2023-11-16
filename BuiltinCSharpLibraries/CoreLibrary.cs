namespace System {
	public class Object {
		[DllImport("InterpreterInternal")]
		private static extern Type Internal_GetObjectType(object obj);
		public virtual string ToString() {
			return this.GetType().ToString();
		}
		public Type GetType(){
			return Internal_GetObjectType(this);
		}
	}
	public class Console {
		[DllImport("InterpreterInternal")]
		private static extern void Internal_JSConsoleLog(string message);
		public static void WriteLine(string message) {
			Internal_JSConsoleLog(message);
		}
	}
	public class Type {}

	public class Boolean {}
	public class Byte {}
	public class SByte {}
	public class Int16 {}
	public class UInt16 {}
	public class Int32 {}
	public class UInt32 {}
	public class Int64 {}
	public class UInt64 {}
	public class Char {}
	public class Double {}
	public class Single {}
	public class String {}
	public class Decimal {}
}
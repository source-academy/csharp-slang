// This file is only for testing the parser on parsing instruction lists and code blocks
{
    int a = 0;
    this.a = 10;
    int add_1 = 1 + 1;
    int[,] someArray = new int[2,3]{{1, 2, 3}, {4, 5, 6}};
    int[][] someArray2 = new int[][]{new int[]{1}};
    double precedenceTest = 1 + 2 / 3 + 9 * 7 + 1;
    double precedenceTest2 = 1 + 2 / 3 / 4 * 5 + (( 4 + 5 ) * 10) + 9 * 7 + 1;
    Dictionary<int, List<int>>[] b;
    // Evaluation chain tests
    object someArray = this.SomeArrayGet();
    object something = (1 + 1).ToString().Length.ToString().Length.ToString(); // An evaluation chain with parenthese expression, property access and method call.
    object something2 = this.someObject.SomeMethod()
            .SomeGenericMethod<int, double>()
            .SomeMethodWithParameters(1, 2,
                    this.someObject.AnotherMethod(1 + 1, 1 + 3.0f / this.c, this.someObject.AlsoAnotherMethod().AgainAnotherMethod(1, 2, 3))
            );
    object something3 = this.someObject.AgainSomeMethod()[1].ThenSomeMethod()[2][3].FinallySomeMethod().someProperty[4];
    object something4 = 1 + (this.someArray[0]++) * 2 + 3;
    object something5 = this.AgainSomeMethod2(new SomeThing(), new SomeThing2(new SomeGenericThing<int, double, List<string>>(), 1, 2, 3 + 3));
    CastToSomething something6 = (CastToSomething)something5.SomeMethod(1, 2, 3).SomeMethod2((CastToSomething2[])something4, ((CastToSomething3)this.someObject.SomeMethod("Hello World")).someProperty.SomeMethod());
    // A code block without headers
    {
        int i = 1;
        i++;
    }
    object something6;
    // if / if-else / for / for-each / while / do-while / try-catch / try-catch-finally statements
    // if
    if(this.SomeMethod(1)){
        a++;
    }
    // if-else
    if(this.SomeMethod(2)){
        something6 = this.SomeMethod(this.something5);
        a++;
    }
    else{
        this.SomeMethod2(something6, something4);
        a--;
    }
    // for
    for(int i = 0; i + 1; i++){
        a++;
        break;
    }
    for(;;){
        a++;
        continue;
    }
    // for-each
    foreach(int i in new int[]{1, 2, 3}){
        Console.WriteLine(i);
    }
    foreach(int[] i in new int[][]{new int[]{12345}}){
        Console.WriteLine(i[0]);
    }
    // while
    while(this.SomeMethod(2)){
        a++;
    }
    // do-while
    do
    {
        a++;
    }
    while(this.SomeMethod(3));
    // try-catch
    try{
        this.SomeMethodThatMayThrowExceptions();
    }
    catch(Exception1 e1){
        Console.WriteLine(e1.ToString());
    }
    catch(Exception2 e2){
        Console.WriteLine(e2.Message);
    }
    catch{
        Console.WriteLine("Unknown Exception!");
    }
    // try-catch-finally
    try{
        this.SomeMethodThatMayThrowExceptions();
    }
    catch(Exception1 e1){
        Console.WriteLine(e1.ToString());
    }
    catch(Exception2 e2){
        Console.WriteLine(e2.Message);
    }
    finally{
        a++;
    }
    return 1+1;
    return this.ToString();
    return a;
}
/**
 * The CIL operation codes, in both enum representation and string representation.
 */
enum CILOperationCodes {
  add = 'add',
  ldc_i4_0 = 'ldc.i4.0',
  ldc_i4_1 = 'ldc.i4.1',
  ldc_i4_2 = 'ldc.i4.2',
  ldc_i4_3 = 'ldc.i4.3',
  ldc_i4_4 = 'ldc.i4.4',
  ldc_i4_5 = 'ldc.i4.5',
  ldc_i4_6 = 'ldc.i4.6',
  ldc_i4_7 = 'ldc.i4.7',
  ldc_i4_8 = 'ldc.i4.8',
  ldc_i4_s = 'ldc.i4.s',
  ldc_i4 = 'ldc.i4',
  ldloc_0 = 'ldloc.0',
  ldloc_1 = 'ldloc.1',
  ldloc_2 = 'ldloc.2',
  ldloc_3 = 'ldloc.3',
  ldloc_s = 'ldloc.s',
  stloc_0 = 'stloc.0',
  stloc_1 = 'stloc.1',
  stloc_2 = 'stloc.2',
  stloc_3 = 'stloc.3',
  stloc_s = 'stloc.s',
  ldstr = 'ldstr',
  newobj = 'newobj',
  call = 'call',
  ret = 'ret',
  nop = 'nop',
}

type CILOperationCodeArgument = string

export { CILOperationCodes, type CILOperationCodeArgument }

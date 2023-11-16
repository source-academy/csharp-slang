const TestConstantsModule = require('../../__tests__util/TestConstants');
const BinaryUtilModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/util/BinaryUtil');
const ConstantsModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/Constants');

test('Conversion between 32-bit signed integers and bytes [-1000, 1000]', () => {
	for(let i = -1000; i <= 1000; i++) {
		expect(BinaryUtilModule.bytesToInt32LittleEndian(BinaryUtilModule.int32ToBytesLittleEndian(i))).toBe(i);
	}
});

test('Conversion between 32-bit signed integers and bytes: ' + ConstantsModule.INT32_MIN_VALUE + " and " + ConstantsModule.INT32_MAX_VALUE, () => {
	expect(BinaryUtilModule.bytesToInt32LittleEndian(BinaryUtilModule.int32ToBytesLittleEndian(ConstantsModule.INT32_MIN_VALUE))).toBe(ConstantsModule.INT32_MIN_VALUE);
	expect(BinaryUtilModule.bytesToInt32LittleEndian(BinaryUtilModule.int32ToBytesLittleEndian(ConstantsModule.INT32_MAX_VALUE))).toBe(ConstantsModule.INT32_MAX_VALUE);
});
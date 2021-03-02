import { isObject } from "lodash";

type _Object = { [key: string]: any };

export default function plainToFlattenObject(object: _Object) {
  const result: _Object = {};

  function flatten(obj: Record<string, any>, prefix = "") {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (isObject(value)) {
        flatten(value, `${prefix}${key}.`);
      } else {
        result[`${prefix}${key}`] = value;
      }
    });
  }

  flatten(JSON.parse(JSON.stringify(object)));

  return result;
}

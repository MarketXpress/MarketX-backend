import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsPrice(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPrice',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value === 'number') {
            return (
              Number.isFinite(value) &&
              value >= 0 &&
              Number(value.toFixed(2)) === value
            );
          }

          if (typeof value === 'string') {
            return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
          }

          return false;
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid price (non-negative, max 2 decimal places)`;
        },
      },
    });
  };
}

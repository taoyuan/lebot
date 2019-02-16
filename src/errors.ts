export class NestedError extends Error {
  nested: Error;

  constructor(nested: Error);
  constructor(message: string, nested: Error);
  constructor(message: string | Error, nested?: Error) {
    if (message instanceof Error) {
      nested = message;
      message = "";
    }

    super(message);

    this.nested = nested || new Error(message);

    Error.captureStackTrace(this, this.constructor);
    const oldStackDescriptor = Object.getOwnPropertyDescriptor(this, "stack");
    const stackDescriptor = buildStackDescriptor(oldStackDescriptor, nested);
    Object.defineProperty(this, "stack", stackDescriptor);
  }
}

function buildStackDescriptor(oldStackDescriptor, nested) {
  if (oldStackDescriptor.get) {
    return {
      get: function() {
        const stack = oldStackDescriptor.get.call(this);
        return buildCombinedStacks(stack, this.nested);
      }
    };
  } else {
    const stack = oldStackDescriptor.value;
    return {
      value: buildCombinedStacks(stack, nested)
    };
  }
}

function buildCombinedStacks(stack, nested) {
  if (nested) {
    stack += "\nCaused By: " + nested.stack;
  }
  return stack;
}

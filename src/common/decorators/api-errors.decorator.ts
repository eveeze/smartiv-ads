import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

/**
 * A reusable decorator to apply standard error responses to API endpoints.
 * Provides clear documentation for the frontend team in Scalar/Swagger.
 */
export function ApiStandardErrors(
  options: {
    badRequest?: boolean | string;
    unauthorized?: boolean | string;
    forbidden?: boolean | string;
    notFound?: boolean | string;
  } = {
    badRequest: true,
    unauthorized: true,
    forbidden: true,
    notFound: false,
  },
) {
  const decorators: Array<MethodDecorator & ClassDecorator> = [];

  if (options.badRequest) {
    decorators.push(
      ApiBadRequestResponse({
        description:
          typeof options.badRequest === 'string'
            ? options.badRequest
            : 'Validation failed or invalid input data.',
      }),
    );
  }

  if (options.unauthorized) {
    decorators.push(
      ApiUnauthorizedResponse({
        description:
          typeof options.unauthorized === 'string'
            ? options.unauthorized
            : 'Missing or invalid authentication token.',
      }),
    );
  }

  if (options.forbidden) {
    decorators.push(
      ApiForbiddenResponse({
        description:
          typeof options.forbidden === 'string'
            ? options.forbidden
            : 'User does not have required permissions (Role restriction).',
      }),
    );
  }

  if (options.notFound) {
    decorators.push(
      ApiNotFoundResponse({
        description:
          typeof options.notFound === 'string'
            ? options.notFound
            : 'The requested resource was not found.',
      }),
    );
  }

  // Everyone could potentially have a 500 error
  decorators.push(
    ApiInternalServerErrorResponse({
      description: 'Unexpected server/database error.',
    }),
  );

  return applyDecorators(...decorators);
}

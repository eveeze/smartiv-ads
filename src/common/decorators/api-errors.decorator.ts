import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  UnauthorizedErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  InternalServerErrorDto,
} from '../dto/api-response.dto';

/**
 * A reusable decorator to apply standard error responses to API endpoints.
 * Each error response uses a dedicated DTO with correct statusCode/error examples
 * so Scalar docs display accurate example bodies per status code.
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
        type: BadRequestErrorDto,
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
        type: UnauthorizedErrorDto,
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
        type: ForbiddenErrorDto,
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
        type: NotFoundErrorDto,
      }),
    );
  }

  // Everyone could potentially have a 500 error
  decorators.push(
    ApiInternalServerErrorResponse({
      description: 'Unexpected server/database error.',
      type: InternalServerErrorDto,
    }),
  );

  return applyDecorators(...decorators);
}

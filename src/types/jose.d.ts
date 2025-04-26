declare module 'jose' {
  export interface JWTPayload {
    [key: string]: any;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    jti?: string;
    nbf?: number;
    exp?: number;
    iat?: number;
  }

  export interface JWTHeaderParameters {
    alg?: string;
    typ?: string;
    cty?: string;
    crit?: string[];
    kid?: string;
    jku?: string;
    jwk?: Record<string, any>;
    x5u?: string | string[];
    x5c?: string | string[];
    x5t?: string;
    'x5t#S256'?: string;
  }

  export interface JWTVerifyResult {
    payload: JWTPayload;
    protectedHeader: JWTHeaderParameters;
  }

  export function jwtVerify(
    jwt: string,
    key: Uint8Array | KeyLike,
    options?: JWTVerifyOptions
  ): Promise<JWTVerifyResult>;

  export type KeyLike = CryptoKey | Uint8Array | string;

  export interface JWTVerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    clockTolerance?: number;
    issuer?: string | string[];
    maxTokenAge?: number;
    subject?: string;
  }
} 
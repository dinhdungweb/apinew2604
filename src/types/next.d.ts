declare module 'next/server' {
  export class NextRequest extends Request {
    nextUrl: URL;
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      has(name: string): boolean;
    };
    readonly headers: Headers;
    readonly geo: {
      city?: string;
      country?: string;
      region?: string;
    };
    readonly ip?: string;
    readonly url: string;
  }

  export class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      has(name: string): boolean;
    };
    readonly headers: Headers;
    readonly nextUrl: URL;
    readonly redirected: boolean;
    readonly url: string;

    static json(
      body: any,
      init?: ResponseInit
    ): NextResponse;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static next(init?: ResponseInit): NextResponse;
  }
} 
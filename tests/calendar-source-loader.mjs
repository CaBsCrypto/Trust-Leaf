import { registerHooks } from 'node:module';

// Production imports target emitted JavaScript; source tests resolve TypeScript.
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/api/_lib/') && specifier.startsWith('./') && specifier.endsWith('.js')) {
      return next(specifier.replace(/\.js$/, '.ts'), context);
    }
    return next(specifier, context);
  },
});

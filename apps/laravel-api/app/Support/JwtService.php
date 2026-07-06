<?php

namespace App\Support;

class JwtService
{
    public static function accessToken(array $user): string
    {
        return self::makeToken($user, self::secret('app.jwt_access_secret'), now()->addMinutes((int) config('app.access_token_ttl_minutes', 15))->timestamp);
    }

    public static function refreshToken(array $user): string
    {
        return self::makeToken($user, self::secret('app.jwt_refresh_secret'), now()->addDays((int) config('app.refresh_token_ttl_days', 7))->timestamp);
    }

    public static function verifyAccessToken(string $token): array
    {
        [$header, $payload, $signature] = array_pad(explode('.', $token), 3, null);
        if (!$header || !$payload || !$signature) {
            throw new \RuntimeException('Malformed token');
        }

        $expected = self::base64UrlEncode(hash_hmac('sha256', $header.'.'.$payload, self::secret('app.jwt_access_secret'), true));
        if (!hash_equals($expected, $signature)) {
            throw new \RuntimeException('Invalid token signature');
        }

        $claims = json_decode(self::base64UrlDecode($payload), true, 512, JSON_THROW_ON_ERROR);
        if (($claims['exp'] ?? 0) < now()->timestamp) {
            throw new \RuntimeException('Expired token');
        }

        return $claims;
    }

    private static function makeToken(array $user, string $secret, int $expiresAt): string
    {
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256'], JSON_THROW_ON_ERROR));
        $payload = self::base64UrlEncode(json_encode([
            'sub' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'iat' => now()->timestamp,
            'exp' => $expiresAt,
        ], JSON_THROW_ON_ERROR));
        $signature = self::base64UrlEncode(hash_hmac('sha256', $header.'.'.$payload, $secret, true));

        return $header.'.'.$payload.'.'.$signature;
    }

    private static function secret(string $key): string
    {
        $secret = config($key);
        if (!is_string($secret) || $secret === '') {
            throw new \RuntimeException('JWT secret is not configured');
        }

        return $secret;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/')) ?: '';
    }
}

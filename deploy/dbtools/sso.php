<?php
declare(strict_types=1);

$manager = $_GET['manager'] ?? '';
$token = $_GET['token'] ?? '';
if (!in_array($manager, ['phpmyadmin', 'adminer'], true) || $token === '') {
    http_response_code(400);
    echo 'Solicitud SSO invalida.';
    exit;
}

$secretFile = '/etc/ehpanel/dbtools_sso_secret';
$serverFile = '/etc/ehpanel/server0_url';
$envFile = '/etc/ehpanel/ehpanel-web.env';
$secret = is_readable($secretFile) ? trim((string) file_get_contents($secretFile)) : '';
if ($secret === '' && is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        if (str_starts_with($line, 'DBTOOLS_SSO_SECRET=')) {
            $secret = trim(substr($line, strlen('DBTOOLS_SSO_SECRET=')), " \t\n\r\0\x0B\"'");
            break;
        }
    }
}
$requestHost = $_SERVER['HTTP_HOST'] ?? '';
$defaultServer = $requestHost !== '' ? 'https://' . $requestHost : 'https://web.ehclouding.com';
$server0 = is_readable($serverFile) ? rtrim(trim((string) file_get_contents($serverFile)), '/') : $defaultServer;
if ($secret === '') {
    http_response_code(500);
    echo 'SSO no configurado.';
    exit;
}

$payload = json_encode(['token' => $token, 'manager' => $manager]);
$url = $server0 . '/api/hosting/dbtools-sso/consume/';
$headers = [
    'Content-Type: application/json',
    'X-EHPanel-SSO-Secret: ' . $secret,
];

$response = null;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $payload,
            'timeout' => 10,
        ],
    ]);
    $response = @file_get_contents($url, false, $context);
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $status = (int) $matches[1];
    }
}

if ($status < 200 || $status >= 300 || !$response) {
    http_response_code(403);
    echo 'Token SSO no autorizado o expirado.';
    exit;
}

$data = json_decode($response, true);
if (!is_array($data) || empty($data['username']) || empty($data['password']) || empty($data['database'])) {
    http_response_code(403);
    echo 'Respuesta SSO invalida.';
    exit;
}

$db = (string) $data['database'];
$username = (string) $data['username'];
$password = (string) $data['password'];
$host = (string) ($data['host'] ?? '127.0.0.1');
$engine = (string) ($data['engine'] ?? '');

if ($manager === 'phpmyadmin') {
    session_name('EHPanelPmaSignon');
    session_start();
    $_SESSION['PMA_single_signon_user'] = $username;
    $_SESSION['PMA_single_signon_password'] = $password;
    $_SESSION['PMA_single_signon_host'] = $host;
    session_write_close();
    header('Location: /ehpanel-dbtools/phpmyadmin/index.php?server=1&db=' . rawurlencode($db));
    exit;
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>EHPanel DB SSO</title>
</head>
<body>
  <form id="adminer-login" method="post" action="/ehpanel-dbtools/adminer.php">
    <input type="hidden" name="auth[driver]" value="<?php echo $engine === 'postgresql' ? 'pgsql' : 'server'; ?>">
    <input type="hidden" name="auth[server]" value="<?php echo htmlspecialchars($host, ENT_QUOTES); ?>">
    <input type="hidden" name="auth[username]" value="<?php echo htmlspecialchars($username, ENT_QUOTES); ?>">
    <input type="hidden" name="auth[password]" value="<?php echo htmlspecialchars($password, ENT_QUOTES); ?>">
    <input type="hidden" name="auth[db]" value="<?php echo htmlspecialchars($db, ENT_QUOTES); ?>">
  </form>
  <script>document.getElementById('adminer-login').submit()</script>
</body>
</html>

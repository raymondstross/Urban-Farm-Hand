$ErrorActionPreference = "Stop"

$certDir = Join-Path $PSScriptRoot "..\.cert"
$certPath = Join-Path $certDir "localhost-cert.pem"
$keyPath = Join-Path $certDir "localhost-key.pem"

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=localhost")
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  $subject,
  $rsa,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)

$sanBuilder = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$sanBuilder.AddDnsName("localhost")
$sanBuilder.AddIpAddress([System.Net.IPAddress]::Parse("127.0.0.1"))
$sanBuilder.AddIpAddress([System.Net.IPAddress]::Parse("::1"))
$request.CertificateExtensions.Add($sanBuilder.Build())
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
    $true
  )
)

$serverAuth = [System.Security.Cryptography.OidCollection]::new()
$serverAuth.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1")) | Out-Null
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($serverAuth, $true)
)

$cert = $request.CreateSelfSigned(
  [System.DateTimeOffset]::Now.AddDays(-1),
  [System.DateTimeOffset]::Now.AddYears(1)
)

function Convert-ToPem($label, [byte[]] $bytes) {
  $base64 = [Convert]::ToBase64String($bytes, [System.Base64FormattingOptions]::InsertLineBreaks)
  "-----BEGIN $label-----`n$base64`n-----END $label-----`n"
}

function Join-Bytes([byte[][]] $arrays) {
  $bytes = [System.Collections.Generic.List[byte]]::new()
  foreach ($array in $arrays) {
    $bytes.AddRange($array)
  }
  $bytes.ToArray()
}

function Encode-Length([int] $length) {
  if ($length -lt 128) {
    return [byte[]] @($length)
  }

  $parts = [System.Collections.Generic.List[byte]]::new()
  $value = $length
  while ($value -gt 0) {
    $parts.Insert(0, [byte]($value -band 0xff))
    $value = $value -shr 8
  }

  Join-Bytes @(([byte[]] @([byte](0x80 -bor $parts.Count))), $parts.ToArray())
}

function Encode-Tlv([byte] $tag, [byte[]] $value) {
  Join-Bytes @(([byte[]] @($tag)), (Encode-Length $value.Length), $value)
}

function Encode-Integer([byte[]] $value) {
  $start = 0
  while ($start -lt ($value.Length - 1) -and $value[$start] -eq 0) {
    $start++
  }

  $trimmed = $value[$start..($value.Length - 1)]
  if (($trimmed[0] -band 0x80) -ne 0) {
    $trimmed = Join-Bytes @(([byte[]] @(0)), $trimmed)
  }

  Encode-Tlv 0x02 $trimmed
}

function Export-RsaPrivateKeyDer($rsaParameters) {
  $version = Encode-Integer ([byte[]] @(0))
  $body = Join-Bytes @(
    $version,
    (Encode-Integer $rsaParameters.Modulus),
    (Encode-Integer $rsaParameters.Exponent),
    (Encode-Integer $rsaParameters.D),
    (Encode-Integer $rsaParameters.P),
    (Encode-Integer $rsaParameters.Q),
    (Encode-Integer $rsaParameters.DP),
    (Encode-Integer $rsaParameters.DQ),
    (Encode-Integer $rsaParameters.InverseQ)
  )

  Encode-Tlv 0x30 $body
}

Set-Content -Path $certPath -Value (Convert-ToPem "CERTIFICATE" $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)) -NoNewline
Set-Content -Path $keyPath -Value (Convert-ToPem "RSA PRIVATE KEY" (Export-RsaPrivateKeyDer $rsa.ExportParameters($true))) -NoNewline

Write-Host "Created local HTTPS certificate in $certDir"

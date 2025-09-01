---
title: 数据加密与传输安全：构建安全可靠的 API 网关通信体系
date: 2025-08-30
categories: [ApiGateway]
tags: [api-gateway]
published: true
---

在现代微服务架构中，数据安全是至关重要的考虑因素。API 网关作为系统的统一入口，不仅要保护后端服务免受未授权访问，还要确保数据在传输过程中的机密性和完整性。本文将深入探讨数据加密技术和传输安全机制，包括 TLS/SSL 加密、双向认证（mTLS）、数据加密存储等核心技术。

## 数据安全的基本概念

### 数据安全的重要性

在分布式系统中，数据在传输过程中面临多种安全威胁：
1. **窃听攻击**：攻击者可能截获传输中的数据
2. **篡改攻击**：攻击者可能修改传输中的数据
3. **重放攻击**：攻击者可能重复发送合法的数据包
4. **中间人攻击**：攻击者可能伪装成通信双方中的一方

### 数据安全的核心要素

1. **机密性**：确保数据只能被授权方访问
2. **完整性**：确保数据在传输过程中未被篡改
3. **可用性**：确保授权用户能够正常访问数据
4. **不可否认性**：确保数据发送方无法否认已发送的数据

## TLS/SSL 加密技术

### TLS/SSL 基本原理

TLS（Transport Layer Security）和 SSL（Secure Sockets Layer）是用于在互联网上提供通信安全的加密协议。TLS 是 SSL 的继任者，目前广泛使用的是 TLS 1.2 和 TLS 1.3 版本。

### TLS 握手过程

```java
// TLS 握手过程示例
public class TlsHandshakeProcess {
    
    /**
     * TLS 握手过程详解
     */
    public void tlsHandshake() {
        // 1. Client Hello
        // 客户端向服务器发送支持的 TLS 版本、加密套件等信息
        
        // 2. Server Hello
        // 服务器选择 TLS 版本和加密套件，并发送服务器证书
        
        // 3. Certificate Verification
        // 客户端验证服务器证书的有效性
        
        // 4. Key Exchange
        // 双方交换密钥信息，生成会话密钥
        
        // 5. Finished Messages
        // 双方发送加密的 Finished 消息，确认握手完成
        
        // 6. Application Data
        // 使用会话密钥加密传输应用数据
    }
}
```

### API 网关 TLS 配置

```java
// API 网关 TLS 配置
@Configuration
public class TlsConfiguration {
    
    @Bean
    public HttpServer httpsServer() {
        return HttpServer.create()
            .port(443)
            .secure(sslContextSpec -> sslContextSpec
                .sslContext(createSslContext()))
            .handle((req, res) -> {
                // 处理 HTTPS 请求
                return handleHttpsRequest(req, res);
            });
    }
    
    private SslContext createSslContext() {
        try {
            // 加载服务器证书和私钥
            File certFile = new File("server.crt");
            File keyFile = new File("server.key");
            
            return SslContextBuilder.forServer(certFile, keyFile)
                .protocols("TLSv1.2", "TLSv1.3")
                .ciphers(Arrays.asList(
                    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
                    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
                ))
                .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create SSL context", e);
        }
    }
    
    private Mono<Void> handleHttpsRequest(HttpServerRequest req, HttpServerResponse res) {
        // 处理 HTTPS 请求逻辑
        return res.sendString(Mono.just("Secure response"));
    }
}
```

### TLS 配置优化

```yaml
# TLS 配置优化
server:
  port: 443
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: ${SSL_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: server
    protocol: TLS
    enabled-protocols: TLSv1.2,TLSv1.3
    ciphers: >-
      TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
      TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
      TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384
    # 禁用不安全的协议和加密套件
    exclude-cipher-suites:
      - "SSL_RSA_WITH_DES_CBC_SHA"
      - "SSL_DHE_RSA_WITH_DES_CBC_SHA"
      - "SSL_DHE_DSS_WITH_DES_CBC_SHA"
      - "SSL_RSA_EXPORT_WITH_RC4_40_MD5"
      - "SSL_RSA_EXPORT_WITH_DES40_CBC_SHA"
      - "SSL_DHE_RSA_EXPORT_WITH_DES40_CBC_SHA"
      - "SSL_DHE_DSS_EXPORT_WITH_DES40_CBC_SHA"
```

## 双向认证（mTLS）

### mTLS 基本原理

双向认证（Mutual TLS，mTLS）要求通信双方都提供证书并进行验证，确保通信双方的身份都是可信的。这比单向 TLS 提供了更强的安全保障。

### mTLS 实现

```java
// mTLS 配置
@Configuration
public class MutualTlsConfiguration {
    
    @Bean
    public HttpServer mutualTlsServer() {
        return HttpServer.create()
            .port(8443)
            .secure(sslContextSpec -> sslContextSpec
                .sslContext(createMutualTlsContext()))
            .handle((req, res) -> {
                // 验证客户端证书
                if (isClientCertificateValid(req)) {
                    return handleSecureRequest(req, res);
                } else {
                    return handleInvalidCertificate(req, res);
                }
            });
    }
    
    private SslContext createMutualTlsContext() {
        try {
            // 加载服务器证书和私钥
            File serverCert = new File("server.crt");
            File serverKey = new File("server.key");
            
            // 加载受信任的客户端证书颁发机构
            File clientCaCert = new File("client-ca.crt");
            
            return SslContextBuilder.forServer(serverCert, serverKey)
                .clientAuth(ClientAuth.REQUIRE) // 要求客户端认证
                .trustManager(clientCaCert) // 受信任的客户端 CA
                .protocols("TLSv1.2", "TLSv1.3")
                .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create mutual TLS context", e);
        }
    }
    
    private boolean isClientCertificateValid(HttpServerRequest req) {
        // 从请求中提取客户端证书信息
        SSLSession sslSession = req.sslSession();
        if (sslSession == null) {
            return false;
        }
        
        try {
            Certificate[] peerCertificates = sslSession.getPeerCertificates();
            if (peerCertificates == null || peerCertificates.length == 0) {
                return false;
            }
            
            X509Certificate clientCert = (X509Certificate) peerCertificates[0];
            
            // 验证证书有效性
            clientCert.checkValidity();
            
            // 验证证书是否由受信任的 CA 签发
            // 这里可以添加更详细的证书验证逻辑
            
            return true;
        } catch (Exception e) {
            log.warn("Client certificate validation failed", e);
            return false;
        }
    }
    
    private Mono<Void> handleSecureRequest(HttpServerRequest req, HttpServerResponse res) {
        // 处理安全请求
        return res.sendString(Mono.just("Mutual TLS secured response"));
    }
    
    private Mono<Void> handleInvalidCertificate(HttpServerRequest req, HttpServerResponse res) {
        // 处理无效证书请求
        res.status(HttpResponseStatus.UNAUTHORIZED);
        return res.sendString(Mono.just("Invalid client certificate"));
    }
}
```

### 客户端 mTLS 配置

```java
// 客户端 mTLS 配置
@Configuration
public class ClientMutualTlsConfiguration {
    
    @Bean
    public HttpClient mutualTlsClient() {
        try {
            // 加载客户端证书和私钥
            File clientCert = new File("client.crt");
            File clientKey = new File("client.key");
            
            // 加载受信任的服务器证书颁发机构
            File serverCaCert = new File("server-ca.crt");
            
            SslContext sslContext = SslContextBuilder.forClient()
                .keyManager(clientCert, clientKey) // 客户端证书和私钥
                .trustManager(serverCaCert) // 受信任的服务器 CA
                .build();
            
            return HttpClient.create()
                .secure(sslSpec -> sslSpec.sslContext(sslContext))
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create mutual TLS client", e);
        }
    }
}
```

## 数据加密存储

### 敏感数据加密

```java
// 敏感数据加密服务
@Service
public class DataEncryptionService {
    
    private final SecretKey encryptionKey;
    private final Cipher encryptCipher;
    private final Cipher decryptCipher;
    
    public DataEncryptionService(@Value("${encryption.key}") String base64Key) {
        try {
            // 从 Base64 字符串解码密钥
            byte[] keyBytes = Base64.getDecoder().decode(base64Key);
            this.encryptionKey = new SecretKeySpec(keyBytes, "AES");
            
            // 初始化加密和解密器
            this.encryptCipher = Cipher.getInstance("AES/GCM/NoPadding");
            this.decryptCipher = Cipher.getInstance("AES/GCM/NoPadding");
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize encryption service", e);
        }
    }
    
    /**
     * 加密敏感数据
     */
    public String encrypt(String plaintext) {
        try {
            // 生成随机 IV
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            
            GCMParameterSpec gcmSpec = new GCMParameterSpec(128, iv);
            encryptCipher.init(Cipher.ENCRYPT_MODE, encryptionKey, gcmSpec);
            
            byte[] ciphertext = encryptCipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            
            // 将 IV 和密文组合
            byte[] encryptedData = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, encryptedData, 0, iv.length);
            System.arraycopy(ciphertext, 0, encryptedData, iv.length, ciphertext.length);
            
            // 返回 Base64 编码的结果
            return Base64.getEncoder().encodeToString(encryptedData);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }
    
    /**
     * 解密敏感数据
     */
    public String decrypt(String encryptedData) {
        try {
            // 解码 Base64 数据
            byte[] encryptedBytes = Base64.getDecoder().decode(encryptedData);
            
            // 提取 IV 和密文
            byte[] iv = new byte[12];
            byte[] ciphertext = new byte[encryptedBytes.length - 12];
            System.arraycopy(encryptedBytes, 0, iv, 0, 12);
            System.arraycopy(encryptedBytes, 12, ciphertext, 0, ciphertext.length);
            
            GCMParameterSpec gcmSpec = new GCMParameterSpec(128, iv);
            decryptCipher.init(Cipher.DECRYPT_MODE, encryptionKey, gcmSpec);
            
            byte[] plaintext = decryptCipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
```

### 配置加密存储

```java
// 配置加密存储服务
@Service
public class EncryptedConfigService {
    
    private final DataEncryptionService encryptionService;
    private final Map<String, String> encryptedConfigMap = new ConcurrentHashMap<>();
    
    public EncryptedConfigService(DataEncryptionService encryptionService) {
        this.encryptionService = encryptionService;
    }
    
    /**
     * 存储加密配置
     */
    public void storeEncryptedConfig(String key, String plaintextValue) {
        String encryptedValue = encryptionService.encrypt(plaintextValue);
        encryptedConfigMap.put(key, encryptedValue);
    }
    
    /**
     * 获取解密配置
     */
    public String getDecryptedConfig(String key) {
        String encryptedValue = encryptedConfigMap.get(key);
        if (encryptedValue == null) {
            return null;
        }
        return encryptionService.decrypt(encryptedValue);
    }
    
    /**
     * 批量加密配置
     */
    public void storeEncryptedConfigs(Map<String, String> configs) {
        configs.forEach(this::storeEncryptedConfig);
    }
}
```

## 传输层安全优化

### 连接池优化

```java
// 连接池优化配置
@Configuration
public class SecureConnectionPoolConfiguration {
    
    @Bean
    public HttpClient secureHttpClient() {
        return HttpClient.create(ConnectionProvider.builder("secure-pool")
                .maxConnections(500)
                .pendingAcquireTimeout(Duration.ofSeconds(60))
                .maxIdleTime(Duration.ofSeconds(30))
                .maxLifeTime(Duration.ofMinutes(5))
                .evictInBackground(Duration.ofMinutes(1))
                .build())
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .responseTimeout(Duration.ofSeconds(30))
            .secure(sslContextSpec -> sslContextSpec
                .sslContext(createOptimizedSslContext()))
            .compress(true);
    }
    
    private SslContext createOptimizedSslContext() {
        try {
            return SslContextBuilder.forClient()
                .protocols("TLSv1.2", "TLSv1.3")
                .ciphers(getOptimizedCipherSuites())
                .sessionCacheSize(10000)
                .sessionTimeout(300)
                .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create optimized SSL context", e);
        }
    }
    
    private List<String> getOptimizedCipherSuites() {
        return Arrays.asList(
            "TLS_AES_256_GCM_SHA384",
            "TLS_AES_128_GCM_SHA256",
            "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
            "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
        );
    }
}
```

### 会话复用

```java
// 会话复用配置
@Configuration
public class SessionReuseConfiguration {
    
    @Bean
    public HttpClient sessionReuseHttpClient() {
        try {
            SslContext sslContext = SslContextBuilder.forClient()
                .sessionCacheSize(10000)
                .sessionTimeout(300)
                .build();
                
            return HttpClient.create()
                .secure(sslSpec -> sslSpec.sslContext(sslContext))
                .option(ChannelOption.SO_KEEPALIVE, true);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create session reuse HTTP client", e);
        }
    }
}
```

## 证书管理

### 证书自动更新

```java
// 证书自动更新服务
@Service
public class CertificateAutoRenewalService {
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final String certFilePath;
    private final String keyFilePath;
    private final long checkIntervalHours;
    
    public CertificateAutoRenewalService(
            @Value("${cert.file.path}") String certFilePath,
            @Value("${key.file.path}") String keyFilePath,
            @Value("${cert.check.interval.hours:24}") long checkIntervalHours) {
        this.certFilePath = certFilePath;
        this.keyFilePath = keyFilePath;
        this.checkIntervalHours = checkIntervalHours;
        
        // 启动定期检查
        scheduler.scheduleAtFixedRate(this::checkAndRenewCertificate, 
                                    0, checkIntervalHours, TimeUnit.HOURS);
    }
    
    private void checkAndRenewCertificate() {
        try {
            X509Certificate certificate = loadCertificate(certFilePath);
            Date expirationDate = certificate.getNotAfter();
            Date now = new Date();
            
            // 如果证书在 30 天内过期，则尝试更新
            long daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
            if (daysUntilExpiration <= 30) {
                log.info("Certificate will expire in {} days, attempting renewal", daysUntilExpiration);
                renewCertificate();
            }
        } catch (Exception e) {
            log.error("Failed to check certificate expiration", e);
        }
    }
    
    private X509Certificate loadCertificate(String certFilePath) throws Exception {
        FileInputStream fis = new FileInputStream(certFilePath);
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(fis);
    }
    
    private void renewCertificate() {
        try {
            // 调用证书颁发机构的 API 或执行证书更新脚本
            // 这里只是一个示例，实际实现会根据具体的证书管理方案而不同
            executeCertificateRenewalScript();
            
            // 重新加载证书
            reloadServerCertificate();
            
            log.info("Certificate renewed successfully");
        } catch (Exception e) {
            log.error("Failed to renew certificate", e);
        }
    }
    
    private void executeCertificateRenewalScript() throws IOException {
        // 执行证书更新脚本
        ProcessBuilder pb = new ProcessBuilder("/path/to/cert-renewal-script.sh");
        Process process = pb.start();
        try {
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new RuntimeException("Certificate renewal script failed with exit code: " + exitCode);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Certificate renewal script interrupted", e);
        }
    }
    
    private void reloadServerCertificate() {
        // 重新加载服务器证书
        // 具体实现取决于使用的服务器框架
        log.info("Server certificate reloaded");
    }
}
```

### 证书验证

```java
// 证书验证服务
@Service
public class CertificateValidationService {
    
    private final Set<String> trustedCaCertificates = new HashSet<>();
    private final Set<String> revokedCertificates = new HashSet<>();
    
    public CertificateValidationService() {
        // 初始化受信任的 CA 证书
        loadTrustedCaCertificates();
        
        // 启动 CRL 检查
        startCrlChecking();
    }
    
    /**
     * 验证证书链
     */
    public boolean validateCertificateChain(X509Certificate[] certificates) {
        try {
            if (certificates == null || certificates.length == 0) {
                return false;
            }
            
            // 验证每个证书
            for (X509Certificate cert : certificates) {
                // 检查证书是否在有效期内
                cert.checkValidity();
                
                // 检查证书是否被吊销
                if (isCertificateRevoked(cert)) {
                    return false;
                }
            }
            
            // 验证证书链
            return verifyCertificateChain(certificates);
        } catch (Exception e) {
            log.warn("Certificate validation failed", e);
            return false;
        }
    }
    
    private boolean verifyCertificateChain(X509Certificate[] certificates) {
        try {
            // 创建证书路径验证器
            CertPathValidator validator = CertPathValidator.getInstance("PKIX");
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            CertPath certPath = factory.generateCertPath(Arrays.asList(certificates));
            
            // 设置验证参数
            PKIXParameters params = new PKIXParameters(trustedCaCertificates);
            params.setRevocationEnabled(true);
            
            // 执行验证
            validator.validate(certPath, params);
            return true;
        } catch (Exception e) {
            log.warn("Certificate chain validation failed", e);
            return false;
        }
    }
    
    private boolean isCertificateRevoked(X509Certificate certificate) {
        // 检查证书是否在吊销列表中
        return revokedCertificates.contains(certificate.getSerialNumber().toString());
    }
    
    private void loadTrustedCaCertificates() {
        // 加载受信任的 CA 证书
        // 实际实现会从配置文件或证书库中加载
    }
    
    private void startCrlChecking() {
        // 启动定期 CRL 检查
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(this::updateRevokedCertificates, 
                                    0, 6, TimeUnit.HOURS);
    }
    
    private void updateRevokedCertificates() {
        // 更新吊销证书列表
        // 实际实现会从 CRL 分发点下载最新的吊销列表
    }
}
```

## 安全监控与审计

### TLS 安全指标

```java
// TLS 安全指标收集
@Component
public class TlsSecurityMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter tlsHandshakeCounter;
    private final Counter tlsHandshakeFailureCounter;
    private final Counter tlsConnectionCounter;
    private final Timer tlsHandshakeTimer;
    
    public TlsSecurityMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.tlsHandshakeCounter = Counter.builder("tls.handshakes")
            .description("TLS handshake count")
            .register(meterRegistry);
        this.tlsHandshakeFailureCounter = Counter.builder("tls.handshake.failures")
            .description("TLS handshake failure count")
            .register(meterRegistry);
        this.tlsConnectionCounter = Counter.builder("tls.connections")
            .description("TLS connection count")
            .register(meterRegistry);
        this.tlsHandshakeTimer = Timer.builder("tls.handshake.time")
            .description("TLS handshake time")
            .register(meterRegistry);
    }
    
    public void recordTlsHandshake() {
        tlsHandshakeCounter.increment();
    }
    
    public void recordTlsHandshakeFailure() {
        tlsHandshakeFailureCounter.increment();
    }
    
    public void recordTlsConnection() {
        tlsConnectionCounter.increment();
    }
    
    public <T> T recordTlsHandshakeTime(Supplier<T> operation) {
        return tlsHandshakeTimer.record(operation);
    }
}
```

### 安全事件审计

```java
// 安全事件审计服务
@Component
public class SecurityAuditService {
    
    private final ApplicationEventPublisher eventPublisher;
    
    public SecurityAuditService(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }
    
    /**
     * 记录 TLS 握手事件
     */
    public void logTlsHandshakeEvent(String clientIp, String cipherSuite, boolean success) {
        TlsHandshakeEvent event = new TlsHandshakeEvent(clientIp, cipherSuite, success);
        eventPublisher.publishEvent(event);
        
        if (success) {
            log.info("TLS handshake successful - Client IP: {}, Cipher Suite: {}", 
                    clientIp, cipherSuite);
        } else {
            log.warn("TLS handshake failed - Client IP: {}, Cipher Suite: {}", 
                    clientIp, cipherSuite);
        }
    }
    
    /**
     * 记录证书验证事件
     */
    public void logCertificateVerificationEvent(String clientIp, String subject, boolean valid) {
        CertificateVerificationEvent event = new CertificateVerificationEvent(
            clientIp, subject, valid);
        eventPublisher.publishEvent(event);
        
        if (valid) {
            log.info("Certificate verification successful - Client IP: {}, Subject: {}", 
                    clientIp, subject);
        } else {
            log.warn("Certificate verification failed - Client IP: {}, Subject: {}", 
                    clientIp, subject);
        }
    }
    
    // TLS 握手事件类
    public static class TlsHandshakeEvent {
        private final String clientIp;
        private final String cipherSuite;
        private final boolean success;
        private final long timestamp;
        
        public TlsHandshakeEvent(String clientIp, String cipherSuite, boolean success) {
            this.clientIp = clientIp;
            this.cipherSuite = cipherSuite;
            this.success = success;
            this.timestamp = System.currentTimeMillis();
        }
        
        // getter 方法
        public String getClientIp() { return clientIp; }
        public String getCipherSuite() { return cipherSuite; }
        public boolean isSuccess() { return success; }
        public long getTimestamp() { return timestamp; }
    }
    
    // 证书验证事件类
    public static class CertificateVerificationEvent {
        private final String clientIp;
        private final String subject;
        private final boolean valid;
        private final long timestamp;
        
        public CertificateVerificationEvent(String clientIp, String subject, boolean valid) {
            this.clientIp = clientIp;
            this.subject = subject;
            this.valid = valid;
            this.timestamp = System.currentTimeMillis();
        }
        
        // getter 方法
        public String getClientIp() { return clientIp; }
        public String getSubject() { return subject; }
        public boolean isValid() { return valid; }
        public long getTimestamp() { return timestamp; }
    }
}
```

## 安全最佳实践

### 配置安全

```yaml
# 安全配置最佳实践
server:
  # 启用 HTTPS
  ssl:
    enabled: true
    # 使用强加密算法
    enabled-protocols: TLSv1.2,TLSv1.3
    # 禁用不安全的加密套件
    exclude-cipher-suites:
      - "SSL_RSA_WITH_DES_CBC_SHA"
      - "SSL_DHE_RSA_WITH_DES_CBC_SHA"
      - "SSL_RSA_EXPORT_WITH_RC4_40_MD5"
    # 证书配置
    key-store: ${SSL_KEYSTORE_PATH}
    key-store-password: ${SSL_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: server
    
  # HTTP 安全头
  http:
    headers:
      # 防止点击劫持
      x-frame-options: DENY
      # XSS 保护
      x-xss-protection: 1; mode=block
      # 内容类型嗅探保护
      x-content-type-options: nosniff
      # 严格传输安全
      strict-transport-security: max-age=31536000 ; includeSubDomains
```

### 密钥管理

```java
// 密钥管理服务
@Service
public class KeyManagementService {
    
    private final String masterKey;
    private final Map<String, SecretKey> derivedKeys = new ConcurrentHashMap<>();
    
    public KeyManagementService(@Value("${master.key}") String masterKey) {
        this.masterKey = masterKey;
    }
    
    /**
     * 派生特定用途的密钥
     */
    public SecretKey deriveKey(String purpose, int keyLength) {
        return derivedKeys.computeIfAbsent(purpose, p -> {
            try {
                // 使用 HKDF 派生密钥
                return hkdfDeriveKey(masterKey.getBytes(StandardCharsets.UTF_8), 
                                   purpose.getBytes(StandardCharsets.UTF_8), 
                                   keyLength);
            } catch (Exception e) {
                throw new RuntimeException("Failed to derive key for purpose: " + purpose, e);
            }
        });
    }
    
    private SecretKey hkdfDeriveKey(byte[] ikm, byte[] info, int length) throws Exception {
        // 实现 HKDF 密钥派生
        // 这里简化了实现，实际应用中应使用标准的 HKDF 实现
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] salt = new byte[32];
        new SecureRandom().nextBytes(salt);
        
        // HKDF-Extract
        Mac hmac = Mac.getInstance("HmacSHA256");
        SecretKeySpec saltKey = new SecretKeySpec(salt, "HmacSHA256");
        hmac.init(saltKey);
        byte[] prk = hmac.doFinal(ikm);
        
        // HKDF-Expand
        byte[] okm = new byte[length];
        byte[] t = new byte[0];
        int pos = 0;
        
        for (int i = 1; pos < length; i++) {
            hmac.init(new SecretKeySpec(prk, "HmacSHA256"));
            hmac.update(t);
            hmac.update(info);
            hmac.update((byte) i);
            t = hmac.doFinal();
            
            int copyLen = Math.min(t.length, length - pos);
            System.arraycopy(t, 0, okm, pos, copyLen);
            pos += copyLen;
        }
        
        return new SecretKeySpec(okm, "AES");
    }
    
    /**
     * 定期轮换主密钥
     */
    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨 2 点执行
    public void rotateMasterKey() {
        // 实现主密钥轮换逻辑
        log.info("Master key rotation initiated");
    }
}
```

## 总结

数据加密与传输安全是 API 网关安全体系的重要组成部分。通过合理配置和实现 TLS/SSL 加密、双向认证、数据加密存储等技术，可以有效保护数据在传输和存储过程中的安全。

关键要点包括：

1. **TLS/SSL 配置**：使用强加密算法，定期更新证书
2. **双向认证**：在高安全要求场景下使用 mTLS
3. **数据加密存储**：对敏感数据进行加密存储
4. **证书管理**：实现证书自动更新和验证机制
5. **安全监控**：收集安全指标，审计安全事件
6. **最佳实践**：遵循安全配置和密钥管理最佳实践

通过深入理解这些安全技术的实现原理和最佳实践，我们可以构建更加安全、可靠的 API 网关通信体系，为微服务系统提供坚实的安全保障。
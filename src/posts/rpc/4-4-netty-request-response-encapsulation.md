---
title: 使用 Netty 封装请求和响应
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在构建高性能的 RPC 框架时，如何高效地封装和处理请求与响应是核心问题之一。Netty 作为一个强大的异步事件驱动的网络应用框架，提供了丰富的编解码器和处理器机制，能够帮助我们轻松实现自定义的 RPC 协议。本章将深入探讨如何使用 Netty 来封装 RPC 请求和响应，为构建完整的 RPC 框架奠定基础。

## RPC 协议设计

### 自定义 RPC 协议格式

在实现 RPC 框架之前，我们需要设计一个自定义的协议格式来传输请求和响应数据。一个典型的 RPC 协议包含以下几个部分：

```java
// RPC 协议格式设计
// +--------+--------+--------+--------+--------+--------+--------+--------+
// |  魔数  | 主版本 | 次版本 |  操作  |        序列化方式        |  数据长度  |
// +--------+--------+--------+--------+--------+--------+--------+--------+
// |                              数据内容                               |
// +--------+--------+--------+--------+--------+--------+--------+--------+

public class RpcProtocol {
    // 协议常量
    public static final int MAGIC_NUMBER = 0x12345678;
    public static final byte VERSION_MAJOR = 1;
    public static final byte VERSION_MINOR = 0;
    
    // 操作类型
    public static final byte OPERATION_REQUEST = 1;
    public static final byte OPERATION_RESPONSE = 2;
    
    // 序列化方式
    public static final byte SERIALIZATION_JAVA = 1;
    public static final byte SERIALIZATION_JSON = 2;
    public static final byte SERIALIZATION_PROTOBUF = 3;
    
    // 协议字段
    private int magicNumber;      // 魔数
    private byte versionMajor;    // 主版本号
    private byte versionMinor;    // 次版本号
    private byte operation;       // 操作类型
    private byte serialization;   // 序列化方式
    private int dataLength;       // 数据长度
    private byte[] data;          // 数据内容
    
    // 构造函数
    public RpcProtocol() {}
    
    public RpcProtocol(byte operation, byte serialization, byte[] data) {
        this.magicNumber = MAGIC_NUMBER;
        this.versionMajor = VERSION_MAJOR;
        this.versionMinor = VERSION_MINOR;
        this.operation = operation;
        this.serialization = serialization;
        this.dataLength = data.length;
        this.data = data;
    }
    
    // getter 和 setter 方法
    public int getMagicNumber() { return magicNumber; }
    public void setMagicNumber(int magicNumber) { this.magicNumber = magicNumber; }
    
    public byte getVersionMajor() { return versionMajor; }
    public void setVersionMajor(byte versionMajor) { this.versionMajor = versionMajor; }
    
    public byte getVersionMinor() { return versionMinor; }
    public void setVersionMinor(byte versionMinor) { this.versionMinor = versionMinor; }
    
    public byte getOperation() { return operation; }
    public void setOperation(byte operation) { this.operation = operation; }
    
    public byte getSerialization() { return serialization; }
    public void setSerialization(byte serialization) { this.serialization = serialization; }
    
    public int getDataLength() { return dataLength; }
    public void setDataLength(int dataLength) { this.dataLength = dataLength; }
    
    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
    
    @Override
    public String toString() {
        return "RpcProtocol{" +
                "magicNumber=" + magicNumber +
                ", versionMajor=" + versionMajor +
                ", versionMinor=" + versionMinor +
                ", operation=" + operation +
                ", serialization=" + serialization +
                ", dataLength=" + dataLength +
                ", data=" + (data != null ? data.length + " bytes" : "null") +
                '}';
    }
}
```

## RPC 请求和响应对象

### RPC 请求对象

```java
import java.io.Serializable;
import java.util.UUID;

// RPC 请求对象
public class RpcRequest implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String requestId;           // 请求ID
    private String serviceName;         // 服务名称
    private String methodName;          // 方法名称
    private Class<?>[] parameterTypes;  // 参数类型
    private Object[] parameters;        // 参数值
    private long timestamp;             // 请求时间戳
    
    public RpcRequest() {
        this.requestId = UUID.randomUUID().toString();
        this.timestamp = System.currentTimeMillis();
    }
    
    public RpcRequest(String serviceName, String methodName, Class<?>[] parameterTypes, Object[] parameters) {
        this();
        this.serviceName = serviceName;
        this.methodName = methodName;
        this.parameterTypes = parameterTypes;
        this.parameters = parameters;
    }
    
    // getter 和 setter 方法
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
    
    public Class<?>[] getParameterTypes() { return parameterTypes; }
    public void setParameterTypes(Class<?>[] parameterTypes) { this.parameterTypes = parameterTypes; }
    
    public Object[] getParameters() { return parameters; }
    public void setParameters(Object[] parameters) { this.parameters = parameters; }
    
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    
    @Override
    public String toString() {
        return "RpcRequest{" +
                "requestId='" + requestId + '\'' +
                ", serviceName='" + serviceName + '\'' +
                ", methodName='" + methodName + '\'' +
                ", parameterTypes=" + java.util.Arrays.toString(parameterTypes) +
                ", parameters=" + java.util.Arrays.toString(parameters) +
                ", timestamp=" + timestamp +
                '}';
    }
}
```

### RPC 响应对象

```java
import java.io.Serializable;

// RPC 响应对象
public class RpcResponse implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String requestId;    // 请求ID
    private Object data;         // 响应数据
    private Exception exception; // 异常信息
    private long timestamp;      // 响应时间戳
    
    public RpcResponse() {
        this.timestamp = System.currentTimeMillis();
    }
    
    public RpcResponse(String requestId) {
        this();
        this.requestId = requestId;
    }
    
    // getter 和 setter 方法
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    
    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }
    
    public Exception getException() { return exception; }
    public void setException(Exception exception) { this.exception = exception; }
    
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    
    public boolean hasError() {
        return exception != null;
    }
    
    @Override
    public String toString() {
        return "RpcResponse{" +
                "requestId='" + requestId + '\'' +
                ", data=" + data +
                ", exception=" + exception +
                ", timestamp=" + timestamp +
                '}';
    }
}
```

## 序列化工具

### 序列化接口

```java
// 序列化接口
public interface Serializer {
    byte[] serialize(Object obj) throws Exception;
    <T> T deserialize(byte[] data, Class<T> clazz) throws Exception;
    byte getType();
}

// Java 原生序列化实现
public class JavaSerializer implements Serializer {
    @Override
    public byte[] serialize(Object obj) throws Exception {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        java.io.ObjectOutputStream oos = new java.io.ObjectOutputStream(bos);
        oos.writeObject(obj);
        oos.close();
        return bos.toByteArray();
    }
    
    @Override
    public <T> T deserialize(byte[] data, Class<T> clazz) throws Exception {
        java.io.ByteArrayInputStream bis = new java.io.ByteArrayInputStream(data);
        java.io.ObjectInputStream ois = new java.io.ObjectInputStream(bis);
        Object obj = ois.readObject();
        ois.close();
        return clazz.cast(obj);
    }
    
    @Override
    public byte getType() {
        return RpcProtocol.SERIALIZATION_JAVA;
    }
}

// JSON 序列化实现
public class JsonSerializer implements Serializer {
    private static final com.fasterxml.jackson.databind.ObjectMapper mapper = 
        new com.fasterxml.jackson.databind.ObjectMapper();
    
    @Override
    public byte[] serialize(Object obj) throws Exception {
        return mapper.writeValueAsString(obj).getBytes();
    }
    
    @Override
    public <T> T deserialize(byte[] data, Class<T> clazz) throws Exception {
        return mapper.readValue(new String(data), clazz);
    }
    
    @Override
    public byte getType() {
        return RpcProtocol.SERIALIZATION_JSON;
    }
}
```

### 序列化管理器

```java
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// 序列化管理器
public class SerializationManager {
    private static final Map<Byte, Serializer> serializers = new ConcurrentHashMap<>();
    
    static {
        // 注册默认的序列化器
        registerSerializer(new JavaSerializer());
        registerSerializer(new JsonSerializer());
    }
    
    public static void registerSerializer(Serializer serializer) {
        serializers.put(serializer.getType(), serializer);
    }
    
    public static Serializer getSerializer(byte type) {
        return serializers.get(type);
    }
    
    public static Serializer getDefaultSerializer() {
        return serializers.get(RpcProtocol.SERIALIZATION_JAVA);
    }
}
```

## Netty 编解码器

### RPC 协议编码器

```java
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.MessageToByteEncoder;

// RPC 协议编码器
public class RpcEncoder extends MessageToByteEncoder<Object> {
    @Override
    protected void encode(ChannelHandlerContext ctx, Object msg, ByteBuf out) throws Exception {
        if (msg instanceof RpcRequest) {
            encodeRequest((RpcRequest) msg, out);
        } else if (msg instanceof RpcResponse) {
            encodeResponse((RpcResponse) msg, out);
        } else {
            throw new IllegalArgumentException("Unsupported message type: " + msg.getClass());
        }
    }
    
    private void encodeRequest(RpcRequest request, ByteBuf out) throws Exception {
        // 序列化请求对象
        Serializer serializer = SerializationManager.getDefaultSerializer();
        byte[] data = serializer.serialize(request);
        
        // 构建协议对象
        RpcProtocol protocol = new RpcProtocol(
            RpcProtocol.OPERATION_REQUEST,
            serializer.getType(),
            data
        );
        
        // 编码协议
        encodeProtocol(protocol, out);
    }
    
    private void encodeResponse(RpcResponse response, ByteBuf out) throws Exception {
        // 序列化响应对象
        Serializer serializer = SerializationManager.getDefaultSerializer();
        byte[] data = serializer.serialize(response);
        
        // 构建协议对象
        RpcProtocol protocol = new RpcProtocol(
            RpcProtocol.OPERATION_RESPONSE,
            serializer.getType(),
            data
        );
        
        // 编码协议
        encodeProtocol(protocol, out);
    }
    
    private void encodeProtocol(RpcProtocol protocol, ByteBuf out) {
        out.writeInt(protocol.getMagicNumber());
        out.writeByte(protocol.getVersionMajor());
        out.writeByte(protocol.getVersionMinor());
        out.writeByte(protocol.getOperation());
        out.writeByte(protocol.getSerialization());
        out.writeInt(protocol.getDataLength());
        out.writeBytes(protocol.getData());
    }
}
```

### RPC 协议解码器

```java
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.ByteToMessageDecoder;

import java.util.List;

// RPC 协议解码器
public class RpcDecoder extends ByteToMessageDecoder {
    private static final int HEADER_LENGTH = 12; // 协议头长度
    
    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
        // 检查是否有足够的数据读取协议头
        if (in.readableBytes() < HEADER_LENGTH) {
            return;
        }
        
        // 标记当前读位置
        in.markReaderIndex();
        
        // 读取协议头
        int magicNumber = in.readInt();
        if (magicNumber != RpcProtocol.MAGIC_NUMBER) {
            in.resetReaderIndex();
            throw new IllegalArgumentException("Invalid magic number: " + magicNumber);
        }
        
        byte versionMajor = in.readByte();
        byte versionMinor = in.readByte();
        byte operation = in.readByte();
        byte serialization = in.readByte();
        int dataLength = in.readInt();
        
        // 检查是否有足够的数据读取数据内容
        if (in.readableBytes() < dataLength) {
            in.resetReaderIndex();
            return;
        }
        
        // 读取数据内容
        byte[] data = new byte[dataLength];
        in.readBytes(data);
        
        // 构建协议对象
        RpcProtocol protocol = new RpcProtocol();
        protocol.setMagicNumber(magicNumber);
        protocol.setVersionMajor(versionMajor);
        protocol.setVersionMinor(versionMinor);
        protocol.setOperation(operation);
        protocol.setSerialization(serialization);
        protocol.setDataLength(dataLength);
        protocol.setData(data);
        
        // 反序列化数据
        Serializer serializer = SerializationManager.getSerializer(serialization);
        if (serializer == null) {
            throw new IllegalArgumentException("Unsupported serialization type: " + serialization);
        }
        
        if (operation == RpcProtocol.OPERATION_REQUEST) {
            RpcRequest request = serializer.deserialize(data, RpcRequest.class);
            out.add(request);
        } else if (operation == RpcProtocol.OPERATION_RESPONSE) {
            RpcResponse response = serializer.deserialize(data, RpcResponse.class);
            out.add(response);
        } else {
            throw new IllegalArgumentException("Unsupported operation type: " + operation);
        }
    }
}
```

## Netty 服务端实现

### RPC 服务端处理器

```java
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// RPC 服务端处理器
public class RpcServerHandler extends SimpleChannelInboundHandler<RpcRequest> {
    private static final Map<String, Object> serviceMap = new ConcurrentHashMap<>();
    
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client connected: " + ctx.channel().remoteAddress());
        super.channelActive(ctx);
    }
    
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client disconnected: " + ctx.channel().remoteAddress());
        super.channelInactive(ctx);
    }
    
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, RpcRequest request) throws Exception {
        System.out.println("Received request: " + request);
        
        // 处理请求
        RpcResponse response = handleRequest(request);
        
        // 发送响应
        ctx.writeAndFlush(response);
    }
    
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("Exception caught: " + cause.getMessage());
        cause.printStackTrace();
        ctx.close();
    }
    
    private RpcResponse handleRequest(RpcRequest request) {
        RpcResponse response = new RpcResponse(request.getRequestId());
        
        try {
            // 查找服务实现
            Object serviceImpl = serviceMap.get(request.getServiceName());
            if (serviceImpl == null) {
                throw new RuntimeException("Service not found: " + request.getServiceName());
            }
            
            // 获取方法
            Class<?> serviceClass = serviceImpl.getClass();
            java.lang.reflect.Method method = serviceClass.getMethod(
                request.getMethodName(), request.getParameterTypes());
            
            // 调用方法
            Object result = method.invoke(serviceImpl, request.getParameters());
            
            // 设置响应结果
            response.setData(result);
        } catch (Exception e) {
            response.setException(e);
        }
        
        return response;
    }
    
    public static void registerService(String serviceName, Object serviceImpl) {
        serviceMap.put(serviceName, serviceImpl);
        System.out.println("Service registered: " + serviceName);
    }
}
```

### RPC 服务端启动类

```java
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;

// RPC 服务端启动类
public class RpcServer {
    private int port;
    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;
    private ChannelFuture channelFuture;
    
    public RpcServer(int port) {
        this.port = port;
    }
    
    public void start() throws InterruptedException {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();
        
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ch.pipeline()
                                    .addLast(new RpcDecoder())    // 添加解码器
                                    .addLast(new RpcEncoder())    // 添加编码器
                                    .addLast(new RpcServerHandler()); // 添加业务处理器
                        }
                    })
                    .option(ChannelOption.SO_BACKLOG, 128)
                    .childOption(ChannelOption.SO_KEEPALIVE, true);
            
            channelFuture = bootstrap.bind(port).sync();
            System.out.println("RPC Server started on port " + port);
            
            // 注册示例服务
            RpcServerHandler.registerService("CalculatorService", new CalculatorService());
            
            // 等待服务关闭
            channelFuture.channel().closeFuture().sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
    
    public void stop() {
        if (channelFuture != null) {
            channelFuture.channel().close();
        }
    }
    
    public static void main(String[] args) {
        RpcServer server = new RpcServer(8080);
        try {
            server.start();
        } catch (InterruptedException e) {
            System.err.println("Server error: " + e.getMessage());
        }
    }
}

// 示例服务实现
class CalculatorService {
    public int add(int a, int b) {
        System.out.println("Calculating " + a + " + " + b);
        return a + b;
    }
    
    public int multiply(int a, int b) {
        System.out.println("Calculating " + a + " * " + b);
        return a * b;
    }
    
    public double divide(double a, double b) {
        if (b == 0) {
            throw new IllegalArgumentException("Division by zero");
        }
        System.out.println("Calculating " + a + " / " + b);
        return a / b;
    }
}
```

## Netty 客户端实现

### RPC 客户端处理器

```java
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

// RPC 客户端处理器
public class RpcClientHandler extends SimpleChannelInboundHandler<RpcResponse> {
    private static final Map<String, CompletableFuture<RpcResponse>> pendingRequests = 
        new ConcurrentHashMap<>();
    
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, RpcResponse response) throws Exception {
        System.out.println("Received response: " + response);
        
        // 获取对应的请求Future
        CompletableFuture<RpcResponse> future = pendingRequests.remove(response.getRequestId());
        if (future != null) {
            future.complete(response);
        }
    }
    
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("Client exception: " + cause.getMessage());
        cause.printStackTrace();
        ctx.close();
    }
    
    public static void addPendingRequest(String requestId, CompletableFuture<RpcResponse> future) {
        pendingRequests.put(requestId, future);
    }
}
```

### RPC 客户端

```java
import io.netty.bootstrap.Bootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

// RPC 客户端
public class RpcClient {
    private String host;
    private int port;
    private EventLoopGroup group;
    private Channel channel;
    
    public RpcClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws InterruptedException {
        group = new NioEventLoopGroup();
        
        try {
            Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(group)
                    .channel(NioSocketChannel.class)
                    .handler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ch.pipeline()
                                    .addLast(new RpcDecoder())    // 添加解码器
                                    .addLast(new RpcEncoder())    // 添加编码器
                                    .addLast(new RpcClientHandler()); // 添加客户端处理器
                        }
                    });
            
            ChannelFuture future = bootstrap.connect(host, port).sync();
            channel = future.channel();
            System.out.println("Connected to RPC server");
        } catch (InterruptedException e) {
            group.shutdownGracefully();
            throw e;
        }
    }
    
    public CompletableFuture<RpcResponse> sendRequest(RpcRequest request) {
        if (channel != null && channel.isActive()) {
            // 创建Future用于接收响应
            CompletableFuture<RpcResponse> future = new CompletableFuture<>();
            
            // 将请求ID和Future关联
            RpcClientHandler.addPendingRequest(request.getRequestId(), future);
            
            // 发送请求
            channel.writeAndFlush(request);
            
            // 设置超时
            future.orTimeout(5, TimeUnit.SECONDS);
            
            return future;
        } else {
            CompletableFuture<RpcResponse> future = new CompletableFuture<>();
            future.completeExceptionally(new RuntimeException("Not connected to server"));
            return future;
        }
    }
    
    public void disconnect() {
        if (channel != null) {
            channel.close();
        }
        if (group != null) {
            group.shutdownGracefully();
        }
        System.out.println("Disconnected from RPC server");
    }
    
    public static void main(String[] args) {
        RpcClient client = new RpcClient("localhost", 8080);
        try {
            client.connect();
            
            // 测试加法
            RpcRequest addRequest = new RpcRequest(
                "CalculatorService",
                "add",
                new Class[]{int.class, int.class},
                new Object[]{10, 20}
            );
            
            CompletableFuture<RpcResponse> addFuture = client.sendRequest(addRequest);
            RpcResponse addResponse = addFuture.get();
            if (addResponse.hasError()) {
                System.err.println("Add error: " + addResponse.getException().getMessage());
            } else {
                System.out.println("10 + 20 = " + addResponse.getData());
            }
            
            // 测试乘法
            RpcRequest multiplyRequest = new RpcRequest(
                "CalculatorService",
                "multiply",
                new Class[]{int.class, int.class},
                new Object[]{5, 6}
            );
            
            CompletableFuture<RpcResponse> multiplyFuture = client.sendRequest(multiplyRequest);
            RpcResponse multiplyResponse = multiplyFuture.get();
            if (multiplyResponse.hasError()) {
                System.err.println("Multiply error: " + multiplyResponse.getException().getMessage());
            } else {
                System.out.println("5 * 6 = " + multiplyResponse.getData());
            }
            
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
            e.printStackTrace();
        } finally {
            client.disconnect();
        }
    }
}
```

## 高级特性

### 连接池管理

```java
import io.netty.channel.Channel;
import io.netty.channel.pool.ChannelPool;
import io.netty.channel.pool.FixedChannelPool;
import io.netty.channel.pool.SimpleChannelPool;

import java.net.InetSocketAddress;
import java.util.concurrent.CompletableFuture;

// RPC 连接池
public class RpcConnectionPool {
    private ChannelPool channelPool;
    
    public RpcConnectionPool(String host, int port) {
        InetSocketAddress address = new InetSocketAddress(host, port);
        // 创建固定大小的连接池
        channelPool = new FixedChannelPool(
            new Bootstrap()
                .group(new NioEventLoopGroup())
                .channel(NioSocketChannel.class)
                .handler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) throws Exception {
                        ch.pipeline()
                                .addLast(new RpcDecoder())
                                .addLast(new RpcEncoder())
                                .addLast(new RpcClientHandler());
                    }
                }),
            new SimpleChannelPool.Handler() {
                @Override
                public void channelReleased(Channel ch) throws Exception {
                    // 连接释放时的处理
                    System.out.println("Channel released: " + ch);
                }
                
                @Override
                public void channelAcquired(Channel ch) throws Exception {
                    // 连接获取时的处理
                    System.out.println("Channel acquired: " + ch);
                }
                
                @Override
                public void channelCreated(Channel ch) throws Exception {
                    // 连接创建时的处理
                    System.out.println("Channel created: " + ch);
                }
            },
            10 // 连接池大小
        );
    }
    
    public CompletableFuture<Channel> acquire() {
        return channelPool.acquire();
    }
    
    public void release(Channel channel) {
        channelPool.release(channel);
    }
    
    public void close() {
        channelPool.close();
    }
}
```

### 超时和重试机制

```java
// 带超时和重试的 RPC 客户端
public class RobustRpcClient extends RpcClient {
    private int maxRetries = 3;
    private long timeoutMillis = 5000;
    
    public RobustRpcClient(String host, int port) {
        super(host, port);
    }
    
    public CompletableFuture<RpcResponse> sendRequestWithRetry(RpcRequest request) {
        return sendRequestWithRetry(request, maxRetries);
    }
    
    private CompletableFuture<RpcResponse> sendRequestWithRetry(RpcRequest request, int retries) {
        CompletableFuture<RpcResponse> future = sendRequest(request);
        
        return future
            .thenCompose(response -> {
                if (response.hasError()) {
                    if (retries > 0) {
                        System.out.println("Request failed, retrying... (" + retries + " retries left)");
                        // 延迟重试
                        return CompletableFuture
                            .delayedExecutor(1000, TimeUnit.MILLISECONDS)
                            .execute(() -> sendRequestWithRetry(request, retries - 1));
                    } else {
                        return CompletableFuture.completedFuture(response);
                    }
                }
                return CompletableFuture.completedFuture(response);
            })
            .orTimeout(timeoutMillis, TimeUnit.MILLISECONDS)
            .exceptionally(throwable -> {
                RpcResponse response = new RpcResponse(request.getRequestId());
                response.setException(new RuntimeException("Request failed: " + throwable.getMessage()));
                return response;
            });
    }
    
    // getter 和 setter 方法
    public int getMaxRetries() { return maxRetries; }
    public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
    
    public long getTimeoutMillis() { return timeoutMillis; }
    public void setTimeoutMillis(long timeoutMillis) { this.timeoutMillis = timeoutMillis; }
}
```

## 总结

通过本章的学习，我们深入了解了如何使用 Netty 来封装 RPC 请求和响应。关键要点包括：

1. **协议设计**：设计了自定义的 RPC 协议格式，包含魔数、版本号、操作类型、序列化方式等字段
2. **对象定义**：定义了 RpcRequest 和 RpcResponse 两个核心对象
3. **序列化**：实现了多种序列化方式，并通过序列化管理器进行统一管理
4. **编解码器**：基于 Netty 实现了 RpcEncoder 和 RpcDecoder，用于协议的编码和解码
5. **服务端实现**：构建了基于 Netty 的 RPC 服务端，包括服务注册和请求处理
6. **客户端实现**：构建了基于 Netty 的 RPC 客户端，支持异步请求和响应处理
7. **高级特性**：实现了连接池、超时控制和重试机制等高级功能

这些技术为构建高性能、可靠的 RPC 框架奠定了坚实的基础。Netty 的异步非阻塞特性和丰富的编解码器支持，使得我们能够轻松实现复杂的网络通信逻辑，同时保持良好的性能和可扩展性。

在下一章中，我们将探讨如何实现动态代理和服务调用链，进一步完善 RPC 框架的功能。
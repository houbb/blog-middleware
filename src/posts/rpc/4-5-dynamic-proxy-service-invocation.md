---
title: 动态代理与服务调用
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在 RPC（Remote Procedure Call）框架中，动态代理是实现透明远程调用的关键技术。通过动态代理，客户端可以像调用本地方法一样调用远程服务，而无需关心底层的网络通信细节。本章将深入探讨动态代理的实现原理，以及如何将其应用于 RPC 框架中的服务调用。

## 动态代理基础

### 什么是动态代理

动态代理是一种在运行时动态生成代理对象的技术。与静态代理需要手动编写代理类不同，动态代理可以在程序运行时根据接口定义自动生成代理对象。

### JDK 动态代理

JDK 动态代理是 Java 标准库提供的动态代理实现，它基于接口实现。

```java
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

// JDK 动态代理示例
public class JdkDynamicProxyExample {
    // 服务接口
    public interface UserService {
        User getUserById(String userId);
        void updateUser(User user);
        List<User> getAllUsers();
    }
    
    // 服务实现
    public static class UserServiceImpl implements UserService {
        @Override
        public User getUserById(String userId) {
            System.out.println("Getting user by ID: " + userId);
            return new User(userId, "John Doe", "john.doe@example.com");
        }
        
        @Override
        public void updateUser(User user) {
            System.out.println("Updating user: " + user);
        }
        
        @Override
        public List<User> getAllUsers() {
            System.out.println("Getting all users");
            return Arrays.asList(
                new User("1", "John Doe", "john.doe@example.com"),
                new User("2", "Jane Smith", "jane.smith@example.com")
            );
        }
    }
    
    // 调用处理器
    public static class UserServiceInvocationHandler implements InvocationHandler {
        private Object target;
        
        public UserServiceInvocationHandler(Object target) {
            this.target = target;
        }
        
        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            System.out.println("Before method call: " + method.getName());
            
            // 调用目标方法
            Object result = method.invoke(target, args);
            
            System.out.println("After method call: " + method.getName());
            return result;
        }
    }
    
    // 测试方法
    public static void main(String[] args) {
        // 创建目标对象
        UserService target = new UserServiceImpl();
        
        // 创建代理对象
        UserService proxy = (UserService) Proxy.newProxyInstance(
            UserService.class.getClassLoader(),
            new Class[]{UserService.class},
            new UserServiceInvocationHandler(target)
        );
        
        // 通过代理对象调用方法
        User user = proxy.getUserById("1");
        System.out.println("User: " + user);
        
        proxy.updateUser(new User("1", "John Updated", "john.updated@example.com"));
        
        List<User> users = proxy.getAllUsers();
        System.out.println("Users: " + users);
    }
}

// 用户实体类
class User {
    private String id;
    private String name;
    private String email;
    
    public User() {}
    
    public User(String id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }
    
    // getter 和 setter 方法
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    @Override
    public String toString() {
        return "User{id='" + id + "', name='" + name + "', email='" + email + "'}";
    }
}
```

### CGLIB 动态代理

CGLIB（Code Generation Library）是一个强大的字节码生成库，可以代理没有实现接口的类。

```java
import net.sf.cglib.proxy.Enhancer;
import net.sf.cglib.proxy.MethodInterceptor;
import net.sf.cglib.proxy.MethodProxy;

// CGLIB 动态代理示例
public class CglibDynamicProxyExample {
    // 没有实现接口的服务类
    public static class ProductService {
        public Product getProductById(String productId) {
            System.out.println("Getting product by ID: " + productId);
            return new Product(productId, "Product Name", 99.99);
        }
        
        public void updateProduct(Product product) {
            System.out.println("Updating product: " + product);
        }
        
        public List<Product> getAllProducts() {
            System.out.println("Getting all products");
            return Arrays.asList(
                new Product("1", "Product 1", 99.99),
                new Product("2", "Product 2", 199.99)
            );
        }
    }
    
    // 方法拦截器
    public static class ProductServiceMethodInterceptor implements MethodInterceptor {
        private Object target;
        
        public ProductServiceMethodInterceptor(Object target) {
            this.target = target;
        }
        
        @Override
        public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
            System.out.println("Before method call: " + method.getName());
            
            // 调用目标方法
            Object result = method.invoke(target, args);
            
            System.out.println("After method call: " + method.getName());
            return result;
        }
    }
    
    // 测试方法
    public static void main(String[] args) {
        // 创建目标对象
        ProductService target = new ProductService();
        
        // 创建代理对象
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(ProductService.class);
        enhancer.setCallback(new ProductServiceMethodInterceptor(target));
        ProductService proxy = (ProductService) enhancer.create();
        
        // 通过代理对象调用方法
        Product product = proxy.getProductById("1");
        System.out.println("Product: " + product);
        
        proxy.updateProduct(new Product("1", "Updated Product", 149.99));
        
        List<Product> products = proxy.getAllProducts();
        System.out.println("Products: " + products);
    }
}

// 产品实体类
class Product {
    private String id;
    private String name;
    private double price;
    
    public Product() {}
    
    public Product(String id, String name, double price) {
        this.id = id;
        this.name = name;
        this.price = price;
    }
    
    // getter 和 setter 方法
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }
    
    @Override
    public String toString() {
        return "Product{id='" + id + "', name='" + name + "', price=" + price + "}";
    }
}
```

## RPC 动态代理实现

### RPC 代理工厂

```java
import java.lang.reflect.Proxy;
import java.util.concurrent.CompletableFuture;

// RPC 代理工厂
public class RpcProxyFactory {
    private RpcClient rpcClient;
    
    public RpcProxyFactory(RpcClient rpcClient) {
        this.rpcClient = rpcClient;
    }
    
    @SuppressWarnings("unchecked")
    public <T> T createProxy(Class<T> serviceInterface, String serviceName) {
        return (T) Proxy.newProxyInstance(
            serviceInterface.getClassLoader(),
            new Class[]{serviceInterface},
            new RpcInvocationHandler(rpcClient, serviceName, serviceInterface)
        );
    }
}

// RPC 调用处理器
class RpcInvocationHandler implements java.lang.reflect.InvocationHandler {
    private RpcClient rpcClient;
    private String serviceName;
    private Class<?> serviceInterface;
    
    public RpcInvocationHandler(RpcClient rpcClient, String serviceName, Class<?> serviceInterface) {
        this.rpcClient = rpcClient;
        this.serviceName = serviceName;
        this.serviceInterface = serviceInterface;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 处理 Object 类的方法
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        
        // 构建 RPC 请求
        RpcRequest request = new RpcRequest(
            serviceName,
            method.getName(),
            method.getParameterTypes(),
            args
        );
        
        // 发送请求并获取响应
        CompletableFuture<RpcResponse> future = rpcClient.sendRequest(request);
        RpcResponse response = future.get();
        
        // 处理响应
        if (response.hasError()) {
            throw response.getException();
        }
        
        return response.getData();
    }
}
```

### 服务接口定义

```java
// 用户服务接口
public interface UserService {
    User getUserById(String userId);
    List<User> getUsersByIds(List<String> userIds);
    void createUser(User user);
    void updateUser(User user);
    void deleteUser(String userId);
    List<User> searchUsers(UserSearchRequest request);
}

// 订单服务接口
public interface OrderService {
    Order createOrder(CreateOrderRequest request);
    Order getOrderById(String orderId);
    List<Order> getOrdersByUserId(String userId);
    void updateOrderStatus(String orderId, OrderStatus status);
    List<Order> searchOrders(OrderSearchRequest request);
}

// 支付服务接口
public interface PaymentService {
    PaymentResult processPayment(PaymentRequest request);
    PaymentResult refund(RefundRequest request);
    PaymentStatus queryPaymentStatus(String paymentId);
    List<PaymentRecord> getPaymentRecords(String orderId);
}
```

### 服务实现示例

```java
// 用户服务实现
@RpcService
public class UserServiceImpl implements UserService {
    @Autowired
    private UserRepository userRepository;
    
    @Override
    public User getUserById(String userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));
    }
    
    @Override
    public List<User> getUsersByIds(List<String> userIds) {
        return userRepository.findByIds(userIds);
    }
    
    @Override
    public void createUser(User user) {
        user.setCreateTime(new Date());
        userRepository.save(user);
    }
    
    @Override
    public void updateUser(User user) {
        user.setUpdateTime(new Date());
        userRepository.save(user);
    }
    
    @Override
    public void deleteUser(String userId) {
        userRepository.deleteById(userId);
    }
    
    @Override
    public List<User> searchUsers(UserSearchRequest request) {
        return userRepository.search(request);
    }
}

// 订单服务实现
@RpcService
public class OrderServiceImpl implements OrderService {
    @Autowired
    private OrderRepository orderRepository;
    
    @Override
    public Order createOrder(CreateOrderRequest request) {
        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setAmount(request.getAmount());
        order.setStatus(OrderStatus.CREATED);
        order.setCreateTime(new Date());
        return orderRepository.save(order);
    }
    
    @Override
    public Order getOrderById(String orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException("Order not found: " + orderId));
    }
    
    @Override
    public List<Order> getOrdersByUserId(String userId) {
        return orderRepository.findByUserId(userId);
    }
    
    @Override
    public void updateOrderStatus(String orderId, OrderStatus status) {
        Order order = getOrderById(orderId);
        order.setStatus(status);
        order.setUpdateTime(new Date());
        orderRepository.save(order);
    }
    
    @Override
    public List<Order> searchOrders(OrderSearchRequest request) {
        return orderRepository.search(request);
    }
}
```

## 服务调用链

### 调用链上下文

```java
// 调用链上下文
public class RpcContext {
    private static final ThreadLocal<RpcContext> CONTEXT_HOLDER = new ThreadLocal<>();
    
    private String traceId;           // 链路追踪ID
    private String spanId;            // 当前跨度ID
    private String parentSpanId;      // 父跨度ID
    private String serviceName;       // 服务名称
    private String methodName;        // 方法名称
    private long startTime;           // 开始时间
    private Map<String, Object> attachments; // 附加信息
    
    public RpcContext() {
        this.traceId = generateTraceId();
        this.startTime = System.currentTimeMillis();
        this.attachments = new ConcurrentHashMap<>();
    }
    
    // 获取当前上下文
    public static RpcContext getCurrentContext() {
        return CONTEXT_HOLDER.get();
    }
    
    // 设置当前上下文
    public static void setCurrentContext(RpcContext context) {
        CONTEXT_HOLDER.set(context);
    }
    
    // 清除当前上下文
    public static void removeCurrentContext() {
        CONTEXT_HOLDER.remove();
    }
    
    // 生成追踪ID
    private String generateTraceId() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }
    
    // getter 和 setter 方法
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    
    public String getSpanId() { return spanId; }
    public void setSpanId(String spanId) { this.spanId = spanId; }
    
    public String getParentSpanId() { return parentSpanId; }
    public void setParentSpanId(String parentSpanId) { this.parentSpanId = parentSpanId; }
    
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
    
    public long getStartTime() { return startTime; }
    public void setStartTime(long startTime) { this.startTime = startTime; }
    
    public Map<String, Object> getAttachments() { return attachments; }
    public void setAttachments(Map<String, Object> attachments) { this.attachments = attachments; }
    
    public void setAttachment(String key, Object value) {
        this.attachments.put(key, value);
    }
    
    public Object getAttachment(String key) {
        return this.attachments.get(key);
    }
}
```

### 调用链拦截器

```java
// 调用链拦截器
public class RpcInvocationChain implements InvocationHandler {
    private Object target;
    private List<RpcInterceptor> interceptors;
    private int currentIndex = 0;
    
    public RpcInvocationChain(Object target, List<RpcInterceptor> interceptors) {
        this.target = target;
        this.interceptors = interceptors;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (currentIndex < interceptors.size()) {
            // 调用下一个拦截器
            RpcInterceptor interceptor = interceptors.get(currentIndex);
            currentIndex++;
            return interceptor.intercept(this, proxy, method, args);
        } else {
            // 调用目标方法
            return method.invoke(target, args);
        }
    }
}

// RPC 拦截器接口
public interface RpcInterceptor {
    Object intercept(RpcInvocationChain chain, Object proxy, Method method, Object[] args) throws Throwable;
}

// 日志拦截器
public class LoggingInterceptor implements RpcInterceptor {
    @Override
    public Object intercept(RpcInvocationChain chain, Object proxy, Method method, Object[] args) throws Throwable {
        String methodName = method.getName();
        System.out.println("LoggingInterceptor - Before: " + methodName);
        
        long startTime = System.currentTimeMillis();
        Object result = chain.invoke(proxy, method, args);
        long endTime = System.currentTimeMillis();
        
        System.out.println("LoggingInterceptor - After: " + methodName + 
                          ", Duration: " + (endTime - startTime) + "ms");
        return result;
    }
}

// 性能监控拦截器
public class PerformanceInterceptor implements RpcInterceptor {
    @Override
    public Object intercept(RpcInvocationChain chain, Object proxy, Method method, Object[] args) throws Throwable {
        String methodName = method.getName();
        long startTime = System.currentTimeMillis();
        
        try {
            Object result = chain.invoke(proxy, method, args);
            return result;
        } finally {
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // 记录性能指标
            MetricsCollector.recordMethodCall(methodName, duration);
        }
    }
}

// 安全拦截器
public class SecurityInterceptor implements RpcInterceptor {
    @Override
    public Object intercept(RpcInvocationChain chain, Object proxy, Method method, Object[] args) throws Throwable {
        // 检查权限
        if (!hasPermission(method)) {
            throw new SecurityException("Permission denied for method: " + method.getName());
        }
        
        // 检查参数
        validateParameters(args);
        
        return chain.invoke(proxy, method, args);
    }
    
    private boolean hasPermission(Method method) {
        // 实现权限检查逻辑
        return true; // 简化处理
    }
    
    private void validateParameters(Object[] args) {
        // 实现参数验证逻辑
        // 简化处理
    }
}

// 链路追踪拦截器
public class TracingInterceptor implements RpcInterceptor {
    @Override
    public Object intercept(RpcInvocationChain chain, Object proxy, Method method, Object[] args) throws Throwable {
        // 创建调用链上下文
        RpcContext context = new RpcContext();
        context.setServiceName(proxy.getClass().getSimpleName());
        context.setMethodName(method.getName());
        
        // 设置上下文
        RpcContext.setCurrentContext(context);
        
        try {
            System.out.println("TracingInterceptor - TraceId: " + context.getTraceId() + 
                              ", SpanId: " + context.getSpanId());
            
            Object result = chain.invoke(proxy, method, args);
            return result;
        } finally {
            // 清除上下文
            RpcContext.removeCurrentContext();
        }
    }
}
```

### 集成调用链的代理工厂

```java
// 集成调用链的 RPC 代理工厂
public class RpcProxyFactoryWithChain {
    private RpcClient rpcClient;
    private List<RpcInterceptor> globalInterceptors;
    
    public RpcProxyFactoryWithChain(RpcClient rpcClient) {
        this.rpcClient = rpcClient;
        this.globalInterceptors = new ArrayList<>();
        
        // 添加默认拦截器
        this.globalInterceptors.add(new TracingInterceptor());
        this.globalInterceptors.add(new LoggingInterceptor());
        this.globalInterceptors.add(new PerformanceInterceptor());
        this.globalInterceptors.add(new SecurityInterceptor());
    }
    
    @SuppressWarnings("unchecked")
    public <T> T createProxy(Class<T> serviceInterface, String serviceName) {
        return (T) Proxy.newProxyInstance(
            serviceInterface.getClassLoader(),
            new Class[]{serviceInterface},
            new RpcInvocationHandlerWithChain(rpcClient, serviceName, serviceInterface, globalInterceptors)
        );
    }
    
    // 添加全局拦截器
    public void addInterceptor(RpcInterceptor interceptor) {
        this.globalInterceptors.add(interceptor);
    }
}

// 集成调用链的 RPC 调用处理器
class RpcInvocationHandlerWithChain implements InvocationHandler {
    private RpcClient rpcClient;
    private String serviceName;
    private Class<?> serviceInterface;
    private List<RpcInterceptor> interceptors;
    
    public RpcInvocationHandlerWithChain(RpcClient rpcClient, String serviceName, 
                                       Class<?> serviceInterface, List<RpcInterceptor> interceptors) {
        this.rpcClient = rpcClient;
        this.serviceName = serviceName;
        this.serviceInterface = serviceInterface;
        this.interceptors = interceptors;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 处理 Object 类的方法
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        
        // 创建调用链
        RpcInvocationChain chain = new RpcInvocationChain(
            new RemoteInvocationHandler(rpcClient, serviceName), 
            interceptors
        );
        
        return chain.invoke(proxy, method, args);
    }
}

// 远程调用处理器
class RemoteInvocationHandler {
    private RpcClient rpcClient;
    private String serviceName;
    
    public RemoteInvocationHandler(RpcClient rpcClient, String serviceName) {
        this.rpcClient = rpcClient;
        this.serviceName = serviceName;
    }
    
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 构建 RPC 请求
        RpcRequest request = new RpcRequest(
            serviceName,
            method.getName(),
            method.getParameterTypes(),
            args
        );
        
        // 添加上下文信息
        RpcContext context = RpcContext.getCurrentContext();
        if (context != null) {
            request.setTraceId(context.getTraceId());
            request.setSpanId(context.getSpanId());
            request.setAttachments(context.getAttachments());
        }
        
        // 发送请求并获取响应
        CompletableFuture<RpcResponse> future = rpcClient.sendRequest(request);
        RpcResponse response = future.get();
        
        // 处理响应
        if (response.hasError()) {
            throw response.getException();
        }
        
        return response.getData();
    }
}
```

## 异步服务调用

### 异步调用支持

```java
// 异步 RPC 代理工厂
public class AsyncRpcProxyFactory {
    private RpcClient rpcClient;
    
    public AsyncRpcProxyFactory(RpcClient rpcClient) {
        this.rpcClient = rpcClient;
    }
    
    @SuppressWarnings("unchecked")
    public <T> T createAsyncProxy(Class<T> serviceInterface, String serviceName) {
        return (T) Proxy.newProxyInstance(
            serviceInterface.getClassLoader(),
            new Class[]{serviceInterface},
            new AsyncRpcInvocationHandler(rpcClient, serviceName, serviceInterface)
        );
    }
}

// 异步 RPC 调用处理器
class AsyncRpcInvocationHandler implements InvocationHandler {
    private RpcClient rpcClient;
    private String serviceName;
    private Class<?> serviceInterface;
    
    public AsyncRpcInvocationHandler(RpcClient rpcClient, String serviceName, Class<?> serviceInterface) {
        this.rpcClient = rpcClient;
        this.serviceName = serviceName;
        this.serviceInterface = serviceInterface;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 处理 Object 类的方法
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        
        // 检查返回类型是否为 CompletableFuture
        if (method.getReturnType().equals(CompletableFuture.class)) {
            return invokeAsync(method, args);
        } else {
            // 同步调用
            return invokeSync(method, args);
        }
    }
    
    private CompletableFuture<Object> invokeAsync(Method method, Object[] args) {
        // 构建 RPC 请求
        RpcRequest request = new RpcRequest(
            serviceName,
            method.getName(),
            method.getParameterTypes(),
            args
        );
        
        // 发送请求
        CompletableFuture<RpcResponse> responseFuture = rpcClient.sendRequest(request);
        
        // 转换为业务对象的 Future
        return responseFuture.thenApply(response -> {
            if (response.hasError()) {
                throw new RuntimeException(response.getException());
            }
            return response.getData();
        });
    }
    
    private Object invokeSync(Method method, Object[] args) throws Throwable {
        // 构建 RPC 请求
        RpcRequest request = new RpcRequest(
            serviceName,
            method.getName(),
            method.getParameterTypes(),
            args
        );
        
        // 发送请求并等待响应
        CompletableFuture<RpcResponse> future = rpcClient.sendRequest(request);
        RpcResponse response = future.get();
        
        // 处理响应
        if (response.hasError()) {
            throw response.getException();
        }
        
        return response.getData();
    }
}

// 异步服务接口示例
public interface AsyncUserService {
    CompletableFuture<User> getUserByIdAsync(String userId);
    CompletableFuture<List<User>> getAllUsersAsync();
    CompletableFuture<Void> updateUserAsync(User user);
}

// 使用异步代理的示例
public class AsyncRpcClientExample {
    public static void main(String[] args) {
        // 创建 RPC 客户端
        RpcClient rpcClient = new RpcClient("localhost", 8080);
        try {
            rpcClient.connect();
            
            // 创建异步代理
            AsyncRpcProxyFactory factory = new AsyncRpcProxyFactory(rpcClient);
            AsyncUserService userService = factory.createAsyncProxy(AsyncUserService.class, "UserService");
            
            // 异步调用
            CompletableFuture<User> userFuture = userService.getUserByIdAsync("1");
            userFuture.thenAccept(user -> {
                System.out.println("User: " + user);
            }).exceptionally(throwable -> {
                System.err.println("Error getting user: " + throwable.getMessage());
                return null;
            });
            
            // 组合多个异步调用
            CompletableFuture<List<User>> usersFuture = userService.getAllUsersAsync();
            CompletableFuture<Void> allTasks = CompletableFuture.allOf(userFuture, usersFuture);
            
            allTasks.thenRun(() -> {
                System.out.println("All async calls completed");
            }).join();
            
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
        } finally {
            rpcClient.disconnect();
        }
    }
}
```

## 服务发现集成

### 服务发现感知的代理

```java
// 服务发现感知的 RPC 代理工厂
public class DiscoveryAwareRpcProxyFactory {
    private ServiceDiscovery serviceDiscovery;
    private LoadBalancer loadBalancer;
    
    public DiscoveryAwareRpcProxyFactory(ServiceDiscovery serviceDiscovery, LoadBalancer loadBalancer) {
        this.serviceDiscovery = serviceDiscovery;
        this.loadBalancer = loadBalancer;
    }
    
    @SuppressWarnings("unchecked")
    public <T> T createProxy(Class<T> serviceInterface, String serviceName) {
        return (T) Proxy.newProxyInstance(
            serviceInterface.getClassLoader(),
            new Class[]{serviceInterface},
            new DiscoveryAwareRpcInvocationHandler(serviceName, serviceDiscovery, loadBalancer)
        );
    }
}

// 服务发现感知的 RPC 调用处理器
class DiscoveryAwareRpcInvocationHandler implements InvocationHandler {
    private String serviceName;
    private ServiceDiscovery serviceDiscovery;
    private LoadBalancer loadBalancer;
    private Map<String, RpcClient> clientCache = new ConcurrentHashMap<>();
    
    public DiscoveryAwareRpcInvocationHandler(String serviceName, 
                                            ServiceDiscovery serviceDiscovery,
                                            LoadBalancer loadBalancer) {
        this.serviceName = serviceName;
        this.serviceDiscovery = serviceDiscovery;
        this.loadBalancer = loadBalancer;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 处理 Object 类的方法
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        
        // 发现服务实例
        List<ServiceInstance> instances = serviceDiscovery.getInstances(serviceName);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceName);
        }
        
        // 负载均衡选择实例
        ServiceInstance instance = loadBalancer.select(instances);
        
        // 获取或创建 RPC 客户端
        String key = instance.getHost() + ":" + instance.getPort();
        RpcClient rpcClient = clientCache.computeIfAbsent(key, k -> {
            RpcClient client = new RpcClient(instance.getHost(), instance.getPort());
            try {
                client.connect();
            } catch (Exception e) {
                throw new RuntimeException("Failed to connect to service instance", e);
            }
            return client;
        });
        
        // 构建 RPC 请求
        RpcRequest request = new RpcRequest(
            serviceName,
            method.getName(),
            method.getParameterTypes(),
            args
        );
        
        // 发送请求并获取响应
        CompletableFuture<RpcResponse> future = rpcClient.sendRequest(request);
        RpcResponse response = future.get();
        
        // 处理响应
        if (response.hasError()) {
            throw response.getException();
        }
        
        return response.getData();
    }
}
```

## 总结

通过本章的学习，我们深入了解了动态代理在 RPC 框架中的应用，以及如何实现服务调用链。关键要点包括：

1. **动态代理基础**：掌握了 JDK 动态代理和 CGLIB 动态代理的实现原理和使用方法
2. **RPC 代理实现**：基于动态代理实现了透明的远程服务调用
3. **调用链设计**：设计了支持拦截器的调用链机制，实现了日志、性能监控、安全控制等功能
4. **异步调用**：支持了基于 CompletableFuture 的异步服务调用
5. **服务发现集成**：实现了与服务发现机制的集成，支持动态服务实例选择

这些技术使得 RPC 框架具备了以下优势：

- **透明性**：客户端可以像调用本地方法一样调用远程服务
- **可扩展性**：通过拦截器机制可以轻松添加新功能
- **高性能**：异步调用和连接池管理提高了系统性能
- **可靠性**：服务发现和负载均衡提高了系统的可用性

在实际应用中，我们可以根据具体需求选择合适的动态代理实现方式，并通过调用链机制添加必要的功能，如监控、安全、链路追踪等，从而构建出功能完善、性能优越的 RPC 框架。

在下一章中，我们将探讨服务注册与发现的实现，进一步完善 RPC 框架的服务治理能力。
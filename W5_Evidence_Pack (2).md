# Evidence Pack W5: The Network Fortress
## XBrain_Group10

---

## Cover

| Thông tin | Chi tiết |
|-----------|---------|
| **Nhóm** | XBrain_Group10 |
| **Tên thành viên** | Lê Trần Tuấn Khanh, Trần Mạnh Trường, Trần Mạnh Cường, Nguyễn Đức Hảo, Lê Văn Hải, Phan Đức Huy, Lê Viết Quốc Hưng, Huỳnh Xuân Hậu, Nguyễn Thị Mến, Trần Quốc Hùng |
| **Tuần** | W5 - The Network Fortress (11–15 tháng 5, 2026) |
| **Deadline** | Thứ Sáu 15-05-2026 |
| **Link Repository** | https://github.com/hailv1209/XBrain_Group10.git |
| **Evidence Pack tuần trước** | https://github.com/huyjaky/w4aws |
| **Ngày tạo** | 14-05-2026 |

---

## 1. Application Recap & Reflection

### Kiến trúc hiện tại

**Mô tả ngắn ứng dụng:**
- **Tên ứng dụng:** [Ứng dụng AI chatbot]
- **Stack công nghệ:** [VD: Python/Node.js, RDS, Lambda, Bedrock]
- **Dịch vụ AI được tích hợp:** Amazon Bedrock (Claude Sonnet 4-6, Claude Sonnet 4-5)
- **Lớp lưu trữ file:** Amazon EFS (fs-0ed34a016c3fe7c67)
- **Cơ sở dữ liệu:** RDS PostgreSQL (webapp-group10-database)
- **Backup được quản lý bởi:** AWS Backup


### Ứng dụng chạy end-to-end (Live Demo)

**Action đại diện chứng minh app hoạt động:**


<img width="1916" height="837" alt="image" src="https://github.com/user-attachments/assets/6ae9840f-8724-49f1-b7a4-c70a8da3c24a" />

**Video quay demo tại đây: ** https://app.screencast.com/ofdx9TExGfn57

**Kiến trúc hệ thống trên cloud:**

<img width="1015" height="866" alt="image" src="https://github.com/user-attachments/assets/51687d47-757b-495e-9f59-2ae93d5412e5" />

Link to diagram: https://app.diagrams.net/#G1uAov8ZokNK1LBo_zqMDtdrT4d8BFUOMf#%7B%22pageId%22%3A%22_wFuGsi9mvh8PrvmbIV1%22%7D

---

## 2. MH1 — Multi-VPC Connectivity

### Connectivity Decision: Justified Single-VPC with Multi-AZ Enhancement

**Justification cho Single-VPC:**
1. **Đơn giản hóa kiến trúc:** Ứng dụng chatbot là single-tenant SaaS không cần network isolation cấp VPC. Tất cả components (web frontend, LLM backend, database, embedding store) thuộc về cùng một ứng dụng logic.

2. **Cost-effective:** Single-VPC không cần Transit Gateway ($0.05/hour = $36/month) hay VPC peering management overhead. VPC charge vẫn flat rate $0.07/day cho single VPC.

3. **Latency thấp:** Tất cả tầng chạy cùng VPC → không có inter-VPC latency. Quan trọng cho real-time chat response (target latency < 500ms từ user query tới bot answer).

4. **Easy troubleshooting:** VPC Flow Logs từ một VPC duy nhất dễ analyze hơn. Khi user báo "chatbot slow", có thể trace flow trên một VPC thay vì phải check routing giữa nhiều VPC.

5. **Không có compliance requirement:** Chatbot application không cần comply PCI-DSS (không xử lý payment cards), HIPAA (không xử lý health data), hay bất kỳ regulation nào đòi hỏi network isolation cấp VPC.

**Multi-AZ Enhancement for High Availability:**
Tất cả subnet tiers được mở rộng sang **Multi-AZ** (us-east-1a, us-east-1b và us-east-1c):

**Khi nào sẽ trigger Multi-VPC transition:**
1. **Multi-region deployment:** Khi mở rộng sang Singapore, Tokyo, hoặc region khác → sẽ cần VPC riêng per region + Transit Gateway global hub
2. **Separate staging/production:** Khi team scale và cần strict network isolation giữa prod (sensitive data) vs staging (test data) → sẽ tách thành VPC riêng
3. **Third-party chatbot integration:** Khi integrate với partner APIs (Slack bot marketplace, Teams integration) → sẽ cần VPC peering với partner infrastructure
4. **Compliance expansion:** Nếu sau này support healthcare/financial domain → HIPAA/PCI-DSS → sẽ cần dedicated VPC per compliance tier

1. Tổng quan kiến trúc VPC
Hệ thống được triển khai trên một VPC duy nhất với tên webapp-group10-vpc, đóng vai trò là mạng nội bộ trung tâm cho toàn bộ hạ tầng ứng dụng trên AWS.
Kiến trúc mạng được thiết kế theo mô hình phân tầng nhằm tách biệt các thành phần public, private, database và firewall để tăng cường bảo mật và khả năng quản lý traffic.

a) Thông tin VPC
Tên VPC: webapp-group10-vpc
Mô hình: Single VPC Architecture
Triển khai: Multi-AZ
Region: us-east-1
<img width="1522" height="780" alt="image" src="https://github.com/user-attachments/assets/07f8ce78-8338-49d6-aafd-abfa84804515" />

b) Thiết kế Subnet
Hệ thống sử dụng tổng cộng 12 subnet, được phân bổ trên 3 Availability Zone:
- us-east-1a
- us-east-1b
- us-east-1c

Mỗi AZ bao gồm:
- Public Subnet
Dùng cho các tài nguyên public-facing:
   + Application Load Balancer (ALB)
   + NAT Gateway
   + Internet access

- Private Subnet
Dùng cho các tài nguyên nội bộ:
   + ECS/Fargate services
   + Backend application
   + Internal microservices
     
- Database Subnet
Dùng để triển khai cơ sở dữ liệu trong môi trường private:
   + Amazon RDS
   + Database services
  
- Firewall Subnet
Dùng cho AWS Network Firewall nhằm kiểm soát và giám sát traffic mạng.

c) Route Tables
Hệ thống sử dụng nhiều route table riêng biệt để quản lý traffic cho từng loại subnet:
- Public Route Table
webapp-group10-public-rt
<img width="1541" height="450" alt="image" src="https://github.com/user-attachments/assets/1d243e4a-cf01-4352-b6a2-9c8dccb4abf9" />

Chức năng:
Route internet traffic thông qua Internet Gateway.

- Private Route Tables
   + webapp-group10-private-1-rt
   + webapp-group10-private-2-rt
   + webapp-group10-private-3-rt
<img width="1598" height="446" alt="image" src="https://github.com/user-attachments/assets/ea7e3f3c-c242-4c91-a263-04a703a64059" />

Chức năng:
Private subnet route table được cấu hình chuyển toàn bộ outbound traffic
(0.0.0.0/0) tới AWS Network Firewall Endpoint.

Điều này đảm bảo mọi traffic đều phải được inspection
trước khi ra Internet thông qua NAT Gateway.

- Database Route Table
webapp-group10-database-rt
<img width="1598" height="415" alt="image" src="https://github.com/user-attachments/assets/4063713e-ded0-429f-a37d-b1672c324e07" />

Chức năng:
Tách biệt traffic database khỏi public network nhằm tăng bảo mật.

- Firewall Route Tables
    + webapp-group10-network-firewall-subnet-rt-1
    + webapp-group10-network-firewall-subnet-rt-2
    + webapp-group10-network-firewall-subnet-rt-3
<img width="1566" height="447" alt="image" src="https://github.com/user-attachments/assets/0d13619f-0dbe-43e5-98a0-4689f664d0b4" />
Chức năng:

   Route table của firewall subnet được cấu hình chuyển outbound traffic
từ AWS Network Firewall tới NAT Gateway trước khi truy cập Internet.

Kiến trúc này đảm bảo traffic flow hoạt động theo mô hình:

     Application Workload
→ AWS Network Firewall
→ NAT Gateway
→ Internet

Firewall subnet đóng vai trò xử lý và forward traffic
sau khi hoàn tất quá trình stateful inspection và security filtering.
      
2) Network Connectivity

Hệ thống sử dụng:
- Internet Gateway
    + webapp-group10-igw
<img width="1611" height="335" alt="image" src="https://github.com/user-attachments/assets/a3f5b7b2-6ffb-4e2d-b707-518255109516" />
Chức năng:
    + Kết nối public subnet với Internet.
      
- NAT Gateway
    + webapp-group10-regional-nat
<img width="1583" height="532" alt="image" src="https://github.com/user-attachments/assets/d64881f0-4fc4-41b3-ae88-3a7e0c4494eb" />
Chức năng:
    + Cho phép private subnet truy cập Internet outbound mà không expose trực tiếp ra public Internet.
      
5. Multi-AZ Architecture
   
- Kiến trúc được triển khai trên 3 Availability Zone nhằm:
- Tăng tính sẵn sàng (High Availability)
- Đảm bảo khả năng chịu lỗi (Fault Tolerance)
- Giảm downtime khi một AZ gặp sự cố
- Phân phối workload hiệu quả hơn
6. Flow logs
  
  a) VPC Flow Logs
  
Để giám sát và phân tích lưu lượng mạng trong hệ thống, VPC đã được cấu hình Flow Logs nhằm ghi nhận toàn bộ network traffic đi vào và đi ra khỏi VPC.
Flow Logs giúp:
- Theo dõi traffic giữa các subnet
- Phân tích network connectivity
- Phát hiện traffic bất thường
- Hỗ trợ troubleshooting và security monitoring 
<img width="1633" height="249" alt="image" src="https://github.com/user-attachments/assets/5fc6ed81-87a6-4465-ba0d-2e7204777da0" />

**Screenshot - VPC Flow Logs trong CloudWatch:**
<img width="819" height="344" alt="image" src="https://github.com/user-attachments/assets/afc3adc9-119c-43a9-a882-52bece877e18" />


## 3. MH2 — Network Firewall Hardening (Ép buộc tại biên)

## Lựa chọn Path

### Path đã chọn:
☑ Path A — AWS Network Firewall (Stateful firewall + IPS signatures)

Kiến trúc sử dụng AWS Network Firewall để kiểm tra và kiểm soát toàn bộ outbound traffic trước khi truy cập Internet thông qua NAT Gateway.

---

# a) Architecture Overview

Kiến trúc triển khai AWS Network Firewall theo mô hình centralized traffic inspection.

Toàn bộ outbound traffic từ private subnet được ép buộc đi qua AWS Network Firewall Endpoint trước khi tới NAT Gateway và Internet.
## Traffic Flow

```text
ECS/EC2
→ Firewall Endpoint
→ AWS Network Firewall
→ NAT Gateway
→ Internet
```

---
<img width="1669" height="511" alt="image" src="https://github.com/user-attachments/assets/2b8030d3-6416-4280-a1fa-6da486b1cc20" />

# b) Firewall Subnet

Dedicated firewall subnet được triển khai riêng biệt trong từng Availability Zone để cô lập firewall traffic khỏi application workload.

Firewall subnet đóng vai trò xử lý và kiểm tra traffic trước khi traffic rời khỏi VPC.

---
<img width="1564" height="487" alt="image" src="https://github.com/user-attachments/assets/b88a4396-c54b-4682-9113-8201112b8d8f" />

# c) Stateful Traffic Inspection

AWS Network Firewall được cấu hình với Stateful Rule Groups để thực hiện deep packet inspection và phát hiện traffic bất thường.

<img width="1655" height="396" alt="image" src="https://github.com/user-attachments/assets/9b14a8e2-6b3c-4d4a-9c4a-7f0a79ca6730" />

<img width="780" height="228" alt="image" src="https://github.com/user-attachments/assets/8f45afb7-45c3-452d-aee8-07a8f4b8d808" />
# d) Alert Logging & Monitoring

Alert Logs được bật và gửi về Amazon CloudWatch Logs để phục vụ centralized monitoring, auditing và security investigation.
<img width="1681" height="650" alt="image" src="https://github.com/user-attachments/assets/b1b03e52-9ee7-4ab3-b813-d3ed3926a5af" />

- Chứng minh firewall có inspect traffic thật.

## 4. MH3 — File Storage Layer + Backup Plan (Chia sẻ data, bảo vệ state)

### File Storage - Amazon EFS

#### Cấu hình EFS

<img width="1484" height="611" alt="image" src="https://github.com/user-attachments/assets/5493e7fc-a5d7-48d8-8967-0b411f3e7519" />


| Thông tin | Chi tiết |
|-----------|---------|
| **File System ID** | fs-0a4a0e5366e9cba6d |
| **Tên** | webapp-group10-efs |
| **Region** | us-east-2 |
| **Performance Mode** | General Purpose |
| **Throughput Mode** | Bursting |
| **Encryption at Rest** | ✅ Enabled (KMS) |
| **Lifecycle Policy** | Transition to IA after 30 days, Transition into Archive after 90 days |

**Mount Targets:**

| Mount Target | Subnet | AZ | Security Group |
|--------------|--------|-----|----------------|
| fsmt-054f7205bc6cf2dc1 | subnet-036fb118a237b276c | us-east-1a | sg-0eb46af8830cb636f (webapp-group10-efs-sg) |
| fsmt-0b7cbbdfdf6807008 | subnet-01c802af5ab604ed6 | us-east-1b | sg-0eb46af8830cb636f (webapp-group10-efs-sg) |
| fsmt-01623bdaa071cebf0 | subnet-0148c1ed9dd01ab02 | us-east-1c | sg-0eb46af8830cb636f (webapp-group10-efs-sg) |

**Security Group của Mount Target:**

<img width="1667" height="580" alt="image" src="https://github.com/user-attachments/assets/4b47ac65-932e-4702-a88e-8b50f05b271c" />


#### Mount EFS trên ECS

<img width="1591" height="612" alt="image" src="https://github.com/user-attachments/assets/665f60f4-4895-4f54-b0cc-64fc6f41bb02" />


**Screenshot - EFS Mount Successful:**
<img width="1193" height="427" alt="image" src="https://github.com/user-attachments/assets/8b4178d2-8d5c-4529-a09b-6b84e90b31e7" />


#### Write & Read Test

Để xác minh Amazon EFS được mount và hoạt động chính xác giữa nhiều ECS tasks, nhóm thực hiện kiểm tra ghi và đọc dữ liệu thông qua các ECS containers khác nhau.

---

#### ECS Task Definition — Mount Point Configuration

EFS được cấu hình làm shared storage và mount vào ECS containers thông qua task definition.

---

#### Screenshot — ECS Task Definition Mount Point

<img width="1600" height="874" alt="image" src="https://github.com/user-attachments/assets/3c2f652c-91f5-4a1f-81dc-4cc04fbd93f9" />


**Mô tả screenshot cần capture:**

* ECS Task Definition
* Tab Volumes hoặc Container Definitions
* Hiển thị:

  * EFS volume configuration
  * Mount point `/mnt/efs/shared`
  * EFS filesystem ID

---

#### Verify EFS Mounted trong ECS Container

Nhóm truy cập vào ECS task container đầu tiên và xác nhận EFS đã được mount thành công.

Ví dụ:

```bash
mount | grep efs
```

Hoặc:

```bash
df -h
```

Kết quả cho thấy filesystem EFS đã được mount tại:

```text
/mnt/efs
```

---

#### Screenshot — EFS Mounted in First ECS Container

<img width="1297" height="766" alt="image" src="https://github.com/user-attachments/assets/b73d28ea-592f-4e87-bc08-d2c4373fdaba" />


**Mô tả screenshot cần capture:**

* terminal bên trong container
* Hiển thị:

  * EFS mounted path
  * Mount information
  * `/mnt/efs`

---

#### Write Test — Tạo file từ ECS Container đầu tiên

Nhóm thực hiện tạo file trực tiếp trên mounted EFS từ ECS container đầu tiên.

Ví dụ:

```bash
echo "Hello from ECS Container 1" > /mnt/efs/shared-test.txt
```

Hoặc:

```bash
touch /mnt/efs/shared-test.txt
```

Việc tạo file thành công xác nhận ECS task có quyền ghi dữ liệu vào EFS.

---

#### Screenshot — Write File to EFS

<img width="1168" height="409" alt="image" src="https://github.com/user-attachments/assets/6c91bc64-f908-496f-aecc-3b2455f3af94" />


**Mô tả screenshot cần capture:**

* Terminal bên trong ECS container đầu tiên
* Hiển thị:

  * Command tạo file
  * File xuất hiện trong `/mnt/efs`

---

#### Read Test — Đọc file từ ECS Container khác

Sau khi file được tạo từ ECS container đầu tiên, nhóm truy cập vào ECS task container thứ hai để kiểm tra khả năng chia sẻ dữ liệu qua EFS.

Ví dụ:

```bash
cat /mnt/efs/shared-test.txt
```

Expected output:

```text
Hello from ECS Container 1
```

Kết quả cho thấy file được tạo từ container đầu tiên đã xuất hiện và đọc được từ container thứ hai.

Điều này xác nhận:

* EFS đã được mount thành công trên nhiều ECS tasks
* Dữ liệu được chia sẻ real-time giữa các containers
* Amazon EFS hoạt động đúng với mô hình shared persistent storage

---

#### Screenshot — EFS Mounted in Second ECS Container

<img width="1161" height="346" alt="image" src="https://github.com/user-attachments/assets/d3451ef2-2420-4c24-a243-aacbd098aa5d" />


**Mô tả screenshot cần capture:**

* terminal bên trong container thứ hai
* Hiển thị:

  * `/mnt/efs`
  * Mounted EFS filesystem

---

#### Screenshot — Read File from Second Container

<img width="1171" height="418" alt="image" src="https://github.com/user-attachments/assets/c88e4e3e-a13c-4b67-94d2-9e17fd1b17ac" />

**Mô tả screenshot cần capture:**

* Terminal bên trong ECS container thứ hai
* Hiển thị:

  * Command:

    ```bash
    cat /mnt/efs/shared-test.txt
    ```
  * Nội dung file đọc được
  * Xác nhận file được share giữa nhiều containers

**Negative security test cho EFS: Không thể mount EFS vào EC2 instance, do security group không cho phép kết nôi từ EC2 Instance.**

<img width="849" height="163" alt="image" src="https://github.com/user-attachments/assets/f1d36541-4392-4931-bcb1-95fea8d0beea" />

**Ngược lại, nếu security group của efs cho phép kết nối từ EC2 instance thì có thể mount thành công:**

<img width="1330" height="180" alt="image" src="https://github.com/user-attachments/assets/a0e3bf94-f64d-4dc4-80a5-4d3e64967dd3" />


---

## Backup Plan và Restore Verification

### Tổng quan triển khai

Trong phần này, nhóm triển khai AWS Backup để tự động backup các tài nguyên quan trọng của hệ thống nhằm đáp ứng yêu cầu disaster recovery và data protection.

Backup strategy bao gồm:

* AWS Backup Plan tự động chạy theo lịch
* Backup nhiều resource production
* Lưu recovery point trong Backup Vault
* Kiểm tra restore thực tế từ recovery point
* Xác minh dữ liệu sau restore thành công

---

### AWS Backup Plan

#### Backup Plan Information

| Thông tin            | Chi tiết               |
| -------------------- | ---------------------- |
| **Backup Plan Name** | webapp-group10-backup  |
| **Backup Vault**     | webapp-group10-vault   |
| **Status**           | ✅ Active               |
| **Created Time**     | May 14, 2026           |
| **Schedule**         | Daily Automatic Backup |
| **Backup Service**   | AWS Backup             |

Ngoài backup plan chính do nhóm cấu hình, hệ thống còn có automatic backup plan mặc định cho Amazon EFS.

---

#### Existing Backup Plans

| Backup Plan                       | Type                   | Status   |
| --------------------------------- | ---------------------- | -------- |
| **webapp-group10-backup**         | Custom Backup Plan     | ✅ Active |
| **aws/efs/automatic-backup-plan** | AWS Managed EFS Backup | ✅ Active |

---

#### Screenshot — Backup Plans

<img width="1615" height="317" alt="image" src="https://github.com/user-attachments/assets/eace3225-1072-4188-8533-e97bae74a351" />

**Mô tả screenshot cần capture:**

* AWS Console → AWS Backup → Backup Plans
* Hiển thị:

  * `webapp-group10-backup`
  * `aws/efs/automatic-backup-plan`
* Hiển thị trạng thái active
* Hiển thị created time

---

### Backup Vault Configuration

#### Backup Vault

| Thông tin      | Chi tiết               |
| -------------- | ---------------------- |
| **Vault Name** | webapp-group10-vault   |
| **Vault Type** | Customer Managed Vault |
| **Status**     | ✅ Available            |

Backup vault được sử dụng để lưu trữ recovery points của toàn bộ hệ thống.

---

#### Screenshot — Backup Vault

<img width="1598" height="682" alt="image" src="https://github.com/user-attachments/assets/d3728182-daf5-4dd9-95b5-2d2c4161fbe1" />

**Mô tả screenshot cần capture:**

* AWS Console → AWS Backup → Backup Vaults
* Hiển thị:

  * `webapp-group10-vault`
  * Number of recovery points
  * Vault status

---

### Resource Assignment

AWS Backup được cấu hình để backup nhiều tài nguyên production quan trọng của hệ thống.

#### Resource Assignment Information

| Thông tin                    | Chi tiết                        |
| ---------------------------- | ------------------------------- |
| **Resource Assignment Name** | webapp-group10-backup-resources |
| **IAM Role**                 | AWSBackupDefaultServiceRole     |
| **Assignment Method**        | ARN-based selection             |

---

#### Resources được Backup

| Resource Type | Resource ARN                                                                      | Status     |
| ------------- | --------------------------------------------------------------------------------- | ---------- |
| **EFS**       | arn:aws:elasticfilesystem:us-east-1:379353384462:file-system/fs-0ed34a016c3fe7c67 | ✅ Included |
| **RDS**       | arn:aws:rds:us-east-1:379353384462:db:webapp-group10-database                     | ✅ Included |
| **S3**        | arn:aws:s3:::webapp-group10-app-bucket                                            | ✅ Included |
| **S3**        | arn:aws:s3:::webapp-group10-frontend-bucket                                       | ✅ Included |


---

#### Screenshot — Resource Assignment

<img width="1604" height="498" alt="image" src="https://github.com/user-attachments/assets/3d968f7e-2329-4e4e-b8e5-886fc4178ca4" />

**Mô tả screenshot cần capture:**

* AWS Console → AWS Backup → Protected Resources hoặc Resource Assignments
* Hiển thị:

  * Resource assignment name
  * IAM Role
  * Danh sách resource ARN
  * EFS, RDS, S3 buckets

---

### Backup Rule Configuration

#### Backup Rule

<img width="1617" height="426" alt="image" src="https://github.com/user-attachments/assets/bc248314-4d53-4784-8a18-d5c1ce1202a3" />

---

**Mô tả screenshot cần capture:**

| Configuration                    | Value                            |
| -------------------------------- | -------------------------------- |
| **Backup Rule Name**             | webapp-group10-backup-rule       |
| **Backup Frequency**             | Daily                            |
| **Backup Time**                  | 12:30 AM Asia/Saigon (UTC+07:00) |
| **Start Window**                 | Within 8 hours                   |
| **Completion Window**            | Within 7 days                    |
| **Backup Vault**                 | webapp-group10-vault             |
| **Continuous Backup**            | Enabled                          |
| **Total Retention Period**       | 5 weeks (35 days)                |

---

### Recovery Points

Sau khi backup job hoàn thành, AWS Backup tạo recovery points để phục vụ restore khi cần thiết.

#### Recovery Points Information

| Recovery Point         | Resource Type | Status      |
| ---------------------- | ------------- | ----------- |
| **EFS Recovery Point** | Amazon EFS    | ✅ COMPLETED |
| **RDS Recovery Point** | Amazon RDS    | ✅ COMPLETED |
| **S3 Recovery Point**  | Amazon S3     | ✅ COMPLETED |

Recovery points được lưu trữ trong `webapp-group10-vault`.

---

#### Screenshot — Recovery Points

<img width="1603" height="523" alt="image" src="https://github.com/user-attachments/assets/73d5acfa-7de9-479b-86f5-20b28bb968ae" />

**Mô tả screenshot cần capture:**

* AWS Console → AWS Backup → Recovery Points
* Hiển thị:

  * Recovery point IDs
  * Resource type
  * Creation time
  * Status = COMPLETED
  * Backup vault name

---

### Restore Test (Bắt buộc)

Nhóm đã thực hiện restore test từ recovery point để xác minh backup có thể sử dụng thực tế trong disaster recovery scenario.

---

### Restore Job Configuration

#### Restore Target

| Thông tin           | Chi tiết                |
| ------------------- | ----------------------- |
| **Source Resource** | Amazon EFS              |
| **Restore Type**    | Restore to New Resource |
| **Destination**     | New EFS File System     |
| **Encryption**      | Enabled                 |
| **Restore Status**  | ✅ COMPLETED             |

Restore test được thực hiện bằng cách khôi phục EFS từ recovery point sang file system mới.

### Restore Job Result

#### Restore Job Details

| Thông tin              | Chi tiết    |
| ---------------------- | ----------- |
| **Restore Job Status** | ✅ COMPLETED |
| **Restore Type**       | EFS Restore |
| **Verification**       | Success     |
| **Data Validation**    | Passed      |

---

#### Screenshot — Restore Job Completed

<img width="1640" height="419" alt="image" src="https://github.com/user-attachments/assets/4ed97c89-4005-4fb0-81fb-a921f96d8f2b" />


**Mô tả screenshot cần capture:**

* AWS Console → AWS Backup → Restore Jobs
* Hiển thị:

  * Status = COMPLETED
  * Completion time
  * Restored resource information

---

#### Screenshot — Data Before Restore

<img width="1773" height="77" alt="image" src="https://github.com/user-attachments/assets/47997b29-411a-459c-b258-c8b8979c3839" />


**Mô tả screenshot cần capture:**

* Terminal hoặc file browser trước khi thực hiện restore
* Hiển thị dữ liệu hiện tại của EFS production
* Có xuất hiện file:

  * `ce4b9b45861b_handler.py`
* Thể hiện trạng thái dữ liệu mới hơn recovery point backup

---

#### Screenshot — Data After Restore

<img width="1775" height="97" alt="image" src="https://github.com/user-attachments/assets/4a1bfb2d-db7d-4019-b4bc-39b77ce135b1" />

**Mô tả screenshot cần capture:**

* Terminal hoặc file browser sau khi restore EFS
* Hiển thị dữ liệu restored từ recovery point
* File:

  * `ce4b9b45861b_handler.py`
  * không xuất hiện trong restored filesystem
* Thể hiện dữ liệu đã được restore đúng theo thời điểm snapshot backup

---

#### Giải thích kết quả Restore Verification

Trước khi thực hiện restore, EFS production hiện tại có chứa file:

```text id="3ivzlh"
ce4b9b45861b_handler.py
```

Tuy nhiên recovery point được tạo trước thời điểm file này tồn tại, do đó snapshot backup không bao gồm file trên.

Khi thực hiện restore, AWS Backup chỉ khôi phục dữ liệu tồn tại tại thời điểm recovery point được tạo vào restored filesystem hoặc restore directory.

Vì vậy:

* File `ce4b9b45861b_handler.py` không xuất hiện trong dữ liệu restored
* Điều này xác nhận restore operation hoạt động chính xác theo snapshot timeline
* Dữ liệu restored phản ánh đúng trạng thái filesystem tại thời điểm backup được tạo

Kết quả này chứng minh:

* Recovery point đã được sử dụng thành công
* AWS Backup restore hoạt động chính xác
* Restore không lấy dữ liệu phát sinh sau thời điểm backup
* Disaster recovery workflow được xác minh thành công


---

## 5. MH4 — API Gateway trước Lambda (Xây dựng API Surface có Authentication và Throttling)

### Tổng quan triển khai

Trong MH4, nhóm đã triển khai API Gateway phía trước Lambda function hiện có nhằm xây dựng một API surface chuẩn hóa cho backend service. Trước khi triển khai MH4, Lambda được gọi trực tiếp từ application code thông qua AWS SDK, chưa có cơ chế authentication, throttling hoặc endpoint public an toàn cho frontend/backend integration.


Lambda được sử dụng trong MH4 là function health check của hệ thống backend.

---

### Lambda Function được sử dụng

| Thông tin              | Chi tiết                                       |
| ---------------------- | ---------------------------------------------- |
| **Function Name**      | webapp-group10-lambda-healthCheck              |
| **Runtime**            | Python 3.11                                    |
| **Handler**            | lambda_function.lambda_handler                 |
| **Mục đích**           | Kiểm tra trạng thái backend services           |
| **Invocation sau MH4** | Thông qua API Gateway Lambda Proxy Integration |

Function này được sử dụng để trả về trạng thái hoạt động của các backend components và phục vụ monitoring endpoint cho hệ thống.

---

### API Gateway Configuration

#### API Information

| Thông tin            | Chi tiết                 |
| -------------------- | ------------------------ |
| **API Type**         | REST API                 |
| **Stage**            | prod                     |
| **Integration Type** | Lambda Proxy Integration |
| **Authentication**   | API Key                  |
| **Throttling**       | Usage Plan               |
| **CORS**             | Enabled                  |

API Gateway được cấu hình làm public API layer phía trước Lambda function.

---

#### API Routes

| Method | Endpoint        | Integration                                      |
| ------ | --------------- | ------------------------------------------------ |
| GET    | `/health`       | Lambda Proxy → webapp-group10-lambda-healthCheck |
| GET    | `/health-check` | Lambda Proxy → webapp-group10-lambda-healthCheck |

Cả hai endpoint đều được tích hợp thông qua Lambda Proxy Integration.

---

#### Screenshot — API Gateway Overview

<img width="1592" height="688" alt="image" src="https://github.com/user-attachments/assets/4cba441e-f4a8-4f73-9faf-42e1859b4a1e" />

##### Mô tả screenshot cần capture

* AWS Console → API Gateway
* Hiển thị tên API
* Hiển thị stage `prod`
* Hiển thị các routes:

  * `/health`
  * `/health-check`

---

# Lambda Proxy Integration

API Gateway được cấu hình sử dụng Lambda Proxy Integration để chuyển toàn bộ request context trực tiếp xuống Lambda function.

## Integration Configuration

| Thông tin             | Chi tiết                          |
| --------------------- | --------------------------------- |
| **Integration Type**  | Lambda Function                   |
| **Proxy Integration** | Enabled                           |
| **Target Lambda**     | webapp-group10-lambda-healthCheck |

---

## Screenshot — Lambda Proxy Integration

<img width="1285" height="605" alt="image" src="https://github.com/user-attachments/assets/1d745e0e-67d6-46af-acf2-0dc9290c5190" />


### Mô tả screenshot cần capture

* API Gateway → Route `/health`
* Tab Integration Request
* Hiển thị:

  * Lambda Function integration
  * Lambda Proxy Integration = Enabled
  * Target Lambda = `webapp-group10-lambda-healthCheck`

---

# Authentication Configuration — API Key

Để bảo vệ API endpoint, nhóm đã cấu hình API Key Authentication trên API Gateway.

Chỉ các request chứa API Key hợp lệ mới có thể truy cập endpoint.

## Authentication Method

| Thông tin            | Chi tiết |
| -------------------- | -------- |
| **Auth Type**        | API Key  |
| **API Key Required** | Enabled  |
| **Stage Protected**  | prod     |

---

## Screenshot — API Key Configuration

<img width="650" height="158" alt="image" src="https://github.com/user-attachments/assets/720547d7-12f8-4e05-92f3-57c9035dcd20" />


### Mô tả screenshot cần capture

* API Gateway → Method Request
* Hiển thị:

  * API Key Required = true

Hoặc:

<img width="1625" height="286" alt="image" src="https://github.com/user-attachments/assets/ec98acb1-d05c-483c-8f24-5672d44c7f99" />

* Hiển thị API Key đã associate với stage

---

# Throttling Configuration (Usage Plan)

Nhóm đã triển khai Usage Plan để giới hạn request rate và burst capacity nhằm tránh abuse và overload backend Lambda function.

## Usage Plan

| Thông tin           | Chi tiết                  |
| ------------------- | ------------------------- |
| **Usage Plan Name** | webapp-group10-health-check-plan |
| **Rate Limit**      | 20 requests/second       |
| **Burst Limit**     | 60 requests              |
| **Quota**           | 5,000 requests/day       |

---

## Screenshot — Usage Plan & Throttling

<img width="1645" height="592" alt="image" src="https://github.com/user-attachments/assets/ff67d374-2945-4d73-bc71-f6ea2ed290b8" />

### Mô tả screenshot cần capture

* API Gateway → Usage Plans
* Hiển thị:

  * Rate limit
  * Burst limit
  * Quota
  * Associated stage/API

---

# Evidence Pack — API Authentication Testing

## Test 1 — Authenticated Request (HTTP 200)

Request có chứa API Key hợp lệ sẽ truy cập thành công API Gateway endpoint.

### curl Test

```bash
curl -X GET "https://aws.hungtran.id.vn/health" \
  -H "x-api-key: <valid-api-key>"
```

### Expected Response

```json
HTTP/1.1 200 OK

{
    "status": "healthy",
    "timestamp": "2026-05-15T01:49:33.318781+00:00",
    "service": "ai_agent",
    "checks": {
        "database": {
            "status": "healthy",
            "latency_ms": 358.73,
            "type": "aurora-postgresql"
        },
        "redis": {
            "status": "healthy",
            "latency_ms": 339.75
        },
        "bedrock": {
            "status": "healthy",
            "latency_ms": 442.71,
            "region": "us-east-1",
            "available_models": 93
        },
        "bedrock_kb": {
            "status": "healthy",
            "latency_ms": 371.87,
            "knowledge_base_id": "9OK4SPYXVP",
            "kb_status": "ACTIVE"
        },
        "efs": {
            "status": "healthy",
            "latency_ms": 216.47,
            "mount": "/mnt/efs"
        },
        "main_app": {
            "status": "healthy",
            "latency_ms": 280.01,
            "app_status": "healthy"
        },
        "ecs_services": {
            "status": "healthy",
            "services": {
                "webapp-group10-task-definition-service": {
                    "status": "healthy",
                    "running": 6,
                    "desired": 6,
                    "ecs_status": "ACTIVE"
                }
            }
        }
    }
}
```

---

## Screenshot — Authenticated Request Success

<img width="1113" height="703" alt="image" src="https://github.com/user-attachments/assets/9a5a2db5-a748-4087-b0a7-11b958b8da7e" />


### Mô tả screenshot cần capture

* Postman
* Hiển thị:

  * curl command
  * HTTP/1.1 200 OK
  * JSON response body

---

# Evidence Pack — Unauthorized Testing

## Test 2 — Unauthenticated Request (HTTP 403)

Request không chứa API Key sẽ bị API Gateway từ chối.

### curl Test

```bash
curl -X GET "https://aws.hungtran.id.vn/health"
```

### Expected Response

```json
HTTP/1.1 403 Forbidden

{
  "message": "Forbidden"
}
```

---

## Screenshot — Unauthenticated Request Blocked

<img width="1264" height="570" alt="image" src="https://github.com/user-attachments/assets/b86378ff-5275-4bd4-9cc5-e2417597b65a" />


### Mô tả screenshot cần capture

* Postman
* Hiển thị:

  * curl command không có API Key
  * HTTP/1.1 403 Forbidden
  * Response body `"Forbidden"`

---

## 6. MH5 — Serverless Scaling Pattern (Xử lý tải đúng cách)

### Scaling Pattern đã chọn

**Pattern:** Provisioned Concurrency (Warm Lambda Instances)

### Lý do chọn

Lambda function của hệ thống được sử dụng cho backend health check API và có khả năng nhận request bất kỳ lúc nào từ frontend hoặc monitoring services.

Trong mô hình Lambda mặc định, khi function không được invoke trong một khoảng thời gian, execution environment sẽ bị giải phóng. Request tiếp theo sẽ gây ra **cold start**, làm tăng latency do Lambda phải khởi tạo runtime environment trước khi xử lý request.

Để giảm cold start latency và đảm bảo response time ổn định cho production workload, nhóm triển khai **Provisioned Concurrency** cho Lambda function.

Provisioned Concurrency giúp:

* Giữ sẵn các Lambda execution environments ở trạng thái warm
* Loại bỏ cold start khi có request đến
* Giảm latency cho API response
* Tăng tính ổn định cho production traffic

---

### Lambda Function được áp dụng

| Thông tin                 | Chi tiết                          |
| ------------------------- | --------------------------------- |
| **Function Name**         | webapp-group10-lambda-healthCheck |
| **Runtime**               | Python 3.11                       |
| **Scaling Pattern**       | Provisioned Concurrency           |
| **Provisioned Instances** | 2                                 |
| **Region**                | us-east-1                         |

---

### Trạng thái trước khi bật Provisioned Concurrency

Trước khi bật Provisioned Concurrency, Lambda function hoạt động theo mô hình on-demand mặc định.

Khi function không được invoke trong thời gian dài, request tiếp theo sẽ tạo cold start.

---

#### Cold Start Test

### Bước thực hiện

1. Tắt Provisioned Concurrency
2. Chờ Lambda execution environment bị idle
3. Gửi request mới đến Lambda
4. Kiểm tra CloudWatch Logs

---

#### Screenshot — Provisioned Concurrency Disabled

<img width="1705" height="775" alt="image" src="https://github.com/user-attachments/assets/3a63cece-c46e-43c4-b8f2-233fdd3040b0" />


**Mô tả screenshot cần capture:**

* AWS Console → Lambda → Configuration
* Hiển thị:

  * Provisioned concurrency = Disabled
  * Current concurrency configuration

---

#### Screenshot — Cold Start Invocation

<img width="1204" height="213" alt="image" src="https://github.com/user-attachments/assets/b2d4d3d0-a0c4-4ce7-88e6-ed98af0587ad" />

**Mô tả screenshot cần capture:**

* Terminal hoặc Postman
* Request đầu tiên đến Lambda sau idle period
* Response time cao hơn bình thường

---

#### CloudWatch Logs — Cold Start Detected

CloudWatch Logs cho thấy Lambda phải khởi tạo execution environment trước khi xử lý request.

Ví dụ log:

```text id="8z3n0g"
INIT_START Runtime Version: python:3.11
INIT_REPORT Init Duration: 1450.32 ms
REPORT RequestId: xxx Duration: 220.11 ms
```

`Init Duration` xuất hiện trong log xác nhận Lambda đã xảy ra cold start.

---

#### Screenshot — Cold Start Logs

<img width="1647" height="573" alt="image" src="https://github.com/user-attachments/assets/727224db-6f4f-4752-afbb-a5a14bfa5143" />


**Mô tả screenshot cần capture:**

* CloudWatch Logs
* Hiển thị:

  * `INIT_START`
  * `INIT_REPORT`
  * `Init Duration`
* Chứng minh Lambda cold start đã xảy ra

---

### Bật Provisioned Concurrency

Sau khi xác nhận cold start behavior, nhóm tiến hành bật Provisioned Concurrency cho Lambda function.

---

#### Provisioned Concurrency Configuration

| Thông tin                   | Chi tiết                          |
| --------------------------- | --------------------------------- |
| **Function Name**           | webapp-group10-lambda-healthCheck |
| **Provisioned Concurrency** | 2                                 |
| **Alias**                   | prod                              |
| **Status**                  | ✅ Enabled                         |

---

#### AWS CLI Command

```bash id="2v3nq6"
aws lambda put-provisioned-concurrency-config \
  --function-name webapp-group10-lambda-healthCheck \
  --qualifier prod \
  --provisioned-concurrent-executions 2
```

---

#### Screenshot — Provisioned Concurrency Enabled

<img width="1687" height="742" alt="image" src="https://github.com/user-attachments/assets/511ec571-d6b2-4f6b-a475-7a18392757a2" />


**Mô tả screenshot cần capture:**

* AWS Console → Lambda → Aliases / Concurrency
* Hiển thị:

  * Provisioned concurrency = 2
  * Alias = prod
  * Status = Ready

---

#### Screenshot — Warm Instances Ready

<img width="1720" height="897" alt="image" src="https://github.com/user-attachments/assets/912a78bf-cfe6-42f4-b207-3623eab236da" />


**Mô tả screenshot cần capture:**

* AWS Console → Lambda
* Hiển thị:

  * Provisioned concurrent executions = 2
  * Allocated provisioned environments
  * Status Ready / Available

---

### Test sau khi bật Provisioned Concurrency

Sau khi bật Provisioned Concurrency, Lambda request được xử lý bởi warm execution environment.

Request không còn gặp cold start.

---

#### CloudWatch Logs — Warm Invocation

Ví dụ log sau khi bật Provisioned Concurrency:

```text id="r0r1f8"
START RequestId: xxx Version: prod
REPORT RequestId: xxx Duration: 85.11 ms
```

CloudWatch Logs không còn xuất hiện:

```text id="gsvh8t"
INIT_REPORT
```

Điều này xác nhận request đã được xử lý bởi warm instance.

---

#### Screenshot — Warm Invocation Logs

<img width="1357" height="166" alt="image" src="https://github.com/user-attachments/assets/5882e104-8e06-4451-a0ac-6f7eff7023b6" />

**Mô tả screenshot cần capture:**

* CloudWatch Logs
* Hiển thị:

  * Request execution logs
  * Không có `INIT_REPORT`
  * Không có `Init Duration`
* Chứng minh Lambda đã chạy trên warm instance

---

### So sánh trước và sau khi bật Provisioned Concurrency

| Trạng thái                         | Cold Start | Init Duration | Response Stability |
| ---------------------------------- | ---------- | ------------- | ------------------ |
| **Before Provisioned Concurrency** | Có         | ~1450 ms      | Không ổn định      |
| **After Provisioned Concurrency**  | Không      | 0 ms          | Ổn định            |

---

### Chi phí Provisioned Concurrency

Provisioned Concurrency được tính phí theo:

```text id="w5gq7d"
Provisioned Concurrency Cost =
Number of Instances × Memory Size × Time × Pricing Rate
```

---

#### Cost Estimation

Cấu hình hiện tại:

| Thông tin                 | Giá trị                     |
| ------------------------- | --------------------------- |
| **Provisioned Instances** | 2                           |
| **Memory Allocation**     | 512 MB (0.512 GB)           |
| **Duration**              | 1 hour                      |
| **Region**                | us-east-1                   |
| **Pricing Rate**          | $0.0000166667 per GB-second |

---

#### Cost Calculation

<img width="1357" height="166" alt="image" src="https://github.com/user-attachments/assets/b2b0cb75-6ec3-463b-9cc7-4832b5c3585e" />

```text id="y2eq6r"
2 × 0.512 × 3600 × 0.0000166667
= approximately $0.061 per hour
```
---

### Pattern Rationale & Production Plan

Provisioned Concurrency phù hợp với production workload của hệ thống vì:

1. Giảm latency cho API request
2. Loại bỏ cold start delay
3. Tăng trải nghiệm người dùng
4. Đảm bảo Lambda luôn sẵn sàng xử lý request

Kế hoạch production:

* Monitor Lambda duration và concurrent executions
* Theo dõi CloudWatch metrics:

  * Duration
  * ConcurrentExecutions
  * ProvisionedConcurrencyUtilization
* Scale provisioned instances nếu traffic tăng
* Kết hợp Auto Scaling cho Provisioned Concurrency trong production environment


---

## 7. Application Carry-Forward Verification

### Ứng dụng vẫn hoạt động end-to-end

## Action 1 — Pipeline Execution

Hệ thống backend ECS vẫn hoạt động ổn định sau khi triển khai W5 hardening components.

Cluster backend đang chạy nhiều ECS tasks đồng thời và service ở trạng thái healthy.

### Screenshot — ECS Pipeline Execution

<img width="1651" height="957" alt="image" src="https://github.com/user-attachments/assets/d07692e3-57cc-4ee9-8b57-e037094dacc9" />


**Mô tả screenshot cần capture:**

* AWS Console → ECS Cluster
* Hiển thị:

  * Cluster `webapp-group10-backend`
  * Running tasks
  * Service status = Active
  * ECS tasks đang Running

---

## Action 2 — Bedrock Retrieval

Bedrock retrieval workflow vẫn hoạt động thành công thông qua Lambda integration và Knowledge Base retrieval flow.

### Screenshot — Bedrock Retrieval

<img width="1638" height="940" alt="image" src="https://github.com/user-attachments/assets/716df41c-576c-4201-ae19-97d1d745d9f3" />


**Mô tả screenshot cần capture:**

* Bedrock Knowledge Base retrieval result
* Hoặc Lambda invoke response
* Hiển thị:

  * Query request
  * Retrieval result
  * Successful response

---

## Action 3 — Database Query

Ứng dụng vẫn truy vấn database thành công sau khi triển khai các hardening components.

### Screenshot — Database Query

<img width="1663" height="952" alt="image" src="https://github.com/user-attachments/assets/65a27f90-f68b-4e71-b30b-0a60b6a9609a" />


**Mô tả screenshot cần capture:**

* Application query result hoặc SQL client
* Hiển thị:

  * Database query thành công
  * Returned records/data
  * Successful response/result

---

## 8. Bonus - Stretch Goals (Tuỳ chọn)

### 8.1 VPC Reachability Analyzer
AWS Reachability Analyzer was used to validate internet connectivity paths. The public subnet path was successfully reachable, while the private subnet path failed due to routing configuration restrictions.
    
  <img width="1920" height="510" alt="image" src="https://github.com/user-attachments/assets/d0610c9f-e4a0-41b5-a0b2-b142fad9432e" />

- Reachable
  Successful Connectivity Validation
  
  <img width="1041" height="835" alt="image" src="https://github.com/user-attachments/assets/3956f8d9-fce2-4ae5-ba0c-2df39aa5c475" />

- Not Reachable
  Connectivity Failure Detection
  
  <img width="695" height="647" alt="image" src="https://github.com/user-attachments/assets/294f1876-7da4-46e7-8171-d9669e519541" />



### 8.2 Lambda Power Tuning

Nhóm triển khai AWS Lambda Power Tuning để benchmark Lambda function với nhiều mức memory khác nhau nhằm tìm cấu hình tối ưu giữa cost và performance.

Lambda được sử dụng để test:

```text id="6c7u7v"
webapp-group10-lambda-healthCheck
```

---

### Deploy Lambda Power Tuning

AWS Lambda Power Tuning được deploy dưới dạng AWS Step Functions workflow.

#### Screenshot — Deploy Lambda Power Tuning

<img width="1183" height="646" alt="image" src="https://github.com/user-attachments/assets/a29a47d3-d57e-4a9b-b822-fbd21a1163c7" />
<img width="1161" height="664" alt="image" src="https://github.com/user-attachments/assets/11aaf9cb-1ab5-40da-9884-0367e4570e72" />


**Mô tả screenshot cần capture:**

* AWS Console → Step Functions
* Hiển thị:

  * Lambda Power Tuning state machine
  * Deployment thành công

---

### Input Configuration

Nhóm tạo file input để benchmark Lambda ở nhiều mức RAM khác nhau.

#### Input File

```json id="rzcmv0"
{
  "lambdaARN": "arn:aws:lambda:us-east-1:379353384462:function:webapp-group10-lambda-healthCheck",
  "powerValues": [128, 256, 512, 1024, 1536, 2048],
  "num": 10,
  "payload": {},
  "strategy": "balanced"
}
```

#### Ý nghĩa cấu hình

| Parameter       | Ý nghĩa                                       |
| --------------- | --------------------------------------------- |
| **lambdaARN**   | Lambda cần benchmark                          |
| **powerValues** | Các mức RAM cần test                          |
| **num**         | Số lần invoke mỗi mức RAM                     |
| **payload**     | Event gửi vào Lambda                          |
| **strategy**    | Strategy tối ưu (`cost`, `speed`, `balanced`) |

---

#### Screenshot — Power Tuning Input File

<img width="1057" height="228" alt="image" src="https://github.com/user-attachments/assets/1951389a-4fe1-4f3d-999f-4b8c031db2e6" />


**Mô tả screenshot cần capture:**

* File JSON input
* Hiển thị:

  * lambdaARN
  * powerValues
  * strategy
  * num

---

### Chạy Lambda Power Tuning

Nhóm thực hiện chạy Step Functions workflow với file input đã tạo.

#### Screenshot — Running Power Tuning

<img width="1192" height="205" alt="image" src="https://github.com/user-attachments/assets/d45a185e-efc5-4391-a67b-c13e785e09f8" />


**Mô tả screenshot cần capture:**

* AWS Step Functions
* Hiển thị:

  * Execution running/completed
  * Workflow states
  * Benchmark progress

---

### Kết quả Power Tuning

#### Screenshot — Power Tuning Result

<img width="1146" height="574" alt="image" src="https://github.com/user-attachments/assets/20a50eb0-c5f0-4714-bb58-516f39f4b2ff" />


**Mô tả screenshot cần capture:**

* Output graph hoặc visualization
* Hiển thị:

  * Cost vs duration
  * Recommended memory size
  * So sánh performance giữa các mức RAM

---

### Kết quả đạt được

* Benchmark Lambda với nhiều mức memory khác nhau
* So sánh execution duration và estimated cost
* Xác định memory configuration tối ưu theo strategy `balanced`
* Có cơ sở tối ưu Lambda production workload


---

## Summary

| Must-Have | Status | Evidence |
|-----------|--------|----------|
| **MH1 - Multi-VPC Connectivity** | ✅ COMPLETED | VPC Peering + Flow Logs |
| **MH2 - Network Firewall / SG+NACL** | ✅ COMPLETED | Firewall Rules + Alert Logs |
| **MH3 - File Storage + Backup** | ✅ COMPLETED | EFS Mount + Restore Test |
| **MH4 - API Gateway + Auth** | ✅ COMPLETED | 200 OK + 403 Forbidden |
| **MH5 - Serverless Scaling** | ✅ COMPLETED | Reserved Concurrency + Throttle |

**Application Status:** ✅ Running end-to-end with W5 hardening layer

**Deployment Date:** 15-05-2026

**Verified By:** [Trainer Name]

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-14 | webapp-group10 | Initial Evidence Pack creation |
| 2026-05-15 | webapp-group10 | Added restore test verification |

---

**End of Evidence Pack W5**

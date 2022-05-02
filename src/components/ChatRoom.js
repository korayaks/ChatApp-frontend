import React, { useEffect, useState } from 'react'
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;
var usernames;
var onlineUsernames = [];
var inGroupUsernames = [];
const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [groupChats, setGroupChats] = useState([]);
    const [tab, setTab] = useState("CHATROOM");
    const [visible, setVisible] = useState(false);
    const [userData, setUserData] = useState({
        username: '',
        password: '',
        receivername: '',
        connected: false,//connected false ise kullanıcı, giriş ekranını görüntüler true ise mesajlaşma ekranını. 
        message: '',
    });
    useEffect(() => {
        console.log(userData);
    }, [userData]);

    const connect = () => {//kullanıcı giriş ekranında herhangi bir validation'a takılmadıysa yeni bir soket oluşturuyoruz.
        let Sock = new SockJS('http://localhost:8080/ws');//Backend server uzantılı yeni bir SockJS nesnesi oluşturuyorum. 
        stompClient = over(Sock);
        stompClient.connect({}, onConnected, onError);//stompClient.connect metodu ile backende bağlanıyorum.
    }

    const onConnected = () => {
        var user = {//kullanıcının giriş yaptığında verdiği bilgiler.
            username: userData.username,
            password: userData.password
        };//kullanıcı ilk olarak registerOrLogin uzantısı ile backende giriş işlemi yapmak istediğini söyler.
        stompClient.subscribe('/user/' + userData.username + '/client/registerOrLogin', onRegisterOrLogin);//backendden gelen mesaj onRegisterOrLogin() methodunda işlenir. Eğer gelen mesaj olumsuz ise kullanıcının tekrar giriş yapmayı denenmesi istenir. 
        stompClient.subscribe('/user/' + userData.username + '/client/userList', onUserList);
        stompClient.subscribe('/user/' + userData.username + '/client/usersInGroupList', onUsersInGroupList);
        stompClient.subscribe('/user/' + userData.username + '/client/introduce', onIntroduce);
        stompClient.send('/app/registerOrLogin', {}, JSON.stringify(user));
        stompClient.send('/app/userList', {}, JSON.stringify(user));
        stompClient.send('/app/usersInGroupList', {}, JSON.stringify(user));
    }

    const userJoin = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "JOIN"
        };//userJoin() fonksiyonunda kullanıcı /app/message uzantısı ile kullanıcı bilgisi ile birlikte backende mesaj yollar ve geri dönüş olarak bir mesaj alır. 
        stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    }//Gelen mesaj /chatroom/public uzantısına yollanacağından gelen mesajı onMessageReceived() fonksiyonunda işliyorum.

    const onIntroduce = (payload) => {// /client/introduce mesajı gönderdiğimizde gelen mesajı işlediğimiz fonksiyon
        var payloadData = JSON.parse(payload.body);
        if (payloadData.senderName !== userData.username) {
            onlineUsernames = payloadData.message;//gelen mesajda onlineUsername dizisi bulunmakta. Gelen mesajdaki diziyi bizim dizimize atıyoruz.
            console.log("Online Listesi => " + onlineUsernames);
        }
    }

    const onRegisterOrLogin = (payload) => {//kullanıcı giriş yapmaya çalıştığında backend tarafından gelen mesaj burada işlenir
        var payloadData = JSON.parse(payload.body);
        if (payloadData.message === "true") {//Eğer gelen mesaj "true" ise kullanıcı bağlanabilir demektir yani mesajlaşma ekranını görüntüleyebilir. (Ya kayır olmuştur ya da giriş yapmıştır ikisi de true olarak döner backend tarafından)
            setUserData({ ...userData, "connected": true });//Kullanıcı başarılı giriş yaptığından userData.connected bilgisini true yapıyorum ve kullanıcı bu sayede mesajlaşma ekranını görüntüleyebiliyor.
            stompClient.subscribe('/chatroom/public', onMessageReceived);// /chatroom/public uzantılı mesajlar Herkese Açık Sohbete ait olmuş oluyor. onMessageReceived() fonksiyonu ile kullanıcıya iletiliyor.
            stompClient.subscribe('/chatroom/group', onMessageReceived);// /chatroom/group uzantılı mesajlar Grup Sohbetine ait olmuş oluyor. onMessageReceived() fonksiyonu ile kullanıcıya iletiliyor.
            stompClient.subscribe('/user/' + userData.username + '/private', onPrivateMessage);// /user/username/private uzantılı tüm mesajlar ise private sohbet olarak kullanıcıya iletilicek
            userJoin(); //kullanıcının giriş işlemi başarılı olduğundan userJoin() fonksiyonu ile giriş yapıyoruz.
        } else {
            alert("Kullanıcı adı veya şifre yanlış.");// eğer gelen mesaj "false" ise kullanıcıdan tekrar kullanıcı adı veya şifre girmesini istiyorum. 
        }
    }

    const onUserList = (payload) => {//Gönderdiğimiz /app/userList uzantılı mesaja cevap olarak gelen mesajı işlediğim fonksiyon
        var payloadData = JSON.parse(payload.body);
        usernames = (payloadData).map(function (item) {//gelen mesajda kayıtlı tüm kullanıcıların bir listesi var (List<User> listesi). 
            if (item.username !== userData.username) {
                privateChats.set(item.username, []);//Listedeki tüm kullanıcıların kullanıcı adlarını privateChats dizisine atıyorum.
            }//Bu sayede kullanıcı mesajlaşma ekranında sol tarafta diğer kullanıcı isimlerini görebiliyor ve isimlere tıklayarak onlara mesaj gönderebiliyor.
            return item.username;
        });
    }

    const onUsersInGroupList = (payload) => {
        var payloadData = JSON.parse(payload.body);
        inGroupUsernames = (payloadData).map(function (item) {
            return item.username;//Grupta olan kullanıcıların listesi.
        });
        console.log("Gruptakiler Listesi => " + inGroupUsernames)
    }
    const onMessageReceived = (payload) => {//Herkese Açık Sohbet ve Grup Sohbet odalarına gelen mesajlar burada işleniyor.
        var payloadData = JSON.parse(payload.body);
        var chatMessage = {
            senderName: userData.username,
            receiverName: payloadData.senderName,
            message: onlineUsernames,
        };
        switch (payloadData.status) {//gelen mesajın status değerine bakarak bu mesajın giriş için mi Herkese Açık Sohbet için mi yoksa Grup Sohbeti için mi buna karar veriyorum.
            case "JOIN"://eğer status JOIN ise kullanıcı başarılı bir giriş yapma isteğinde bulunmuş demektir. Kullanıcıya Mesajlaşma 
                if (onlineUsernames.indexOf(payloadData.senderName) <= -1) {
                    onlineUsernames.push(payloadData.senderName);//JOIN olan kullanıcıyı, eğer halihazırda onlineUsernames dizisinde yoksa bu diziye ekliyorum. 
                }
                if (payloadData.senderName === userData.username) {
                    if (payloadData.message === "true") {//eğer kullanıcı grupta ise mesaj kısmı "true" olacaktır ve bu sayede visible değerini true yaparak 
                        setVisible(true);               //kullanıcının gruba mesaj gönderebilmesi ve mesajları okuyabilmesini sağlıyorum. 
                    } else {
                        setVisible(false);
                    }
                }//introduce mesajının anlamı bağlı diğer kullanıcılara hali hazırda online olan username'leri göndermektir. Bu sayede yeni giriş yapan kullanıcı, hali hazırda online olan diğer tüm kullanıcıları bilecektir. 
                stompClient.send('/app/introduce', {}, JSON.stringify(chatMessage));//Bu bilginin tutulması önemli çünkü kullanıcı mesaj attığında eğer mesaj attığı kullanıcı online değil ise, online olmayan kullanıcı giriş yaptığında mesajı okuması sağlanmaktadır. 
                if (!privateChats.get(payloadData.senderName)) {//kullanıcı yeni giriş yapan diğer kullanıcılara private mesaj atabilmesi için privateChats dizisine kullanıcıyı atar.
                    privateChats.set(payloadData.senderName, []);
                    privateChats.delete(userData.username);//kullanıcının kendisi çıkartılır çünkü kullanıcının kendisine mesaj atmasını istemiyorum.
                    setPrivateChats(new Map(privateChats));
                }
                break;
            case "PUBLIC_MESSAGE"://PUBLIC_MESSAGE ise Herkese Açık Sohbet için gelen mesajları ele alır
                if (payloadData.receiverName === userData.username) {
                    publicChats.push(payloadData);//Eğer bu mesaj kullanıcıya geldiyse publicChats dizisine atar. Bu sayede kullanıcı mesajı okur.
                    setPublicChats([...publicChats]);
                }
                break;
            case "GROUP_MESSAGE"://GROUP_MESSAGE ise Grup Sohbet için gelen mesajları ele alır.
                if (!visible) {//Eğer kullanıcı grupta ise ve 
                    if (payloadData.receiverName === userData.username) {//Eğer mesaj kullanıcının kendisine gelmiş ise
                        groupChats.push(payloadData); //kullanıcı mesajı görüntüleyebilir.
                        setGroupChats([...groupChats]);
                    }
                }
                break;
            case "INFO"://INFO ise kullanıcıların grupta olup olmadığını belirlemek için kullanılıyor. 
                if (payloadData.message === "true") {// eğer gelen mesaj içeriği "true" ise gönderen kullanıcıyı inGroupUsernames dizisine atıyorum.
                    inGroupUsernames.push(payloadData.senderName);//Bunun anlamı grupta olan başka bir kullanıcı mesaj attığı zaman, mesaj bu kullanıcı da grupta olduğu için bu kullanıcıya da gelecektir. 
                } else if (payloadData.message === "false") {//false ise grupta değildir anlamına geliyor
                    const index = inGroupUsernames.indexOf(payloadData.senderName);//eğer hali hazırda kullanıcı inGroupUsernames dizisinde ise diziden çıkartıyorum.
                    if (index > -1) {
                        inGroupUsernames.splice(index, 1);
                    }
                }
                break;
            default:
                break;
        }
    }

    const onPrivateMessage = (payload) => {//private mesaj geldiğinde bu fonksiyon çalışıyor. Bu fonksiyon sayesinde kullanıcı gelen private mesajı görüntüleyebiliyor.
        var payloadData = JSON.parse(payload.body);
        if (privateChats.get(payloadData.senderName)) {
            privateChats.get(payloadData.senderName).push(payloadData);
            setPrivateChats(new Map(privateChats));
        } else {
            let list = [];
            list.push(payloadData);
            privateChats.set(payloadData.senderName, list);
            setPrivateChats(new Map(privateChats));
        }
    }

    const onError = (err) => {//Error alındığında çalışıyor.
        console.log(err);
    }

    const handleMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "message": value });
    }
    const sendValue = () => {//Kullanıcı Herkese Açık Sohbete mesaj göndermiş ise bu fonksiyon çalışıyor.
        if (userData.message !== "" && userData.message.length < 255) {//gönderilecek mesaj kontrol edilir (boş olmamalı ve en fazla 255 karakter olmalı).
            if (stompClient) {
                var chatMessage = {//Bir mesaj oluşturuluyor ve status değerine PUBLIC_MESSAGE ve received yani iletildi alanına "No" atanıyor.
                    senderName: userData.username,
                    receiverName: "",
                    message: userData.message,
                    status: "PUBLIC_MESSAGE",
                    received: "No"
                };
                usernames.forEach(user => {//Bu mesaj herkese gönderileceğinden usernames dizisindeki tüm elemanlara bu mesaj gönderiliyor. usernames dizisinde kayıtlı tüm kullanıcı adları var.
                    const index = onlineUsernames.indexOf(user);
                    if (index > -1) {//Eğer kullanıcı hali hazırda online ise received alanı "Yes" oluyor.
                        chatMessage.received = "Yes";
                    } else {
                        chatMessage.received = "No";
                    }
                    chatMessage.receiverName = user;
                    stompClient.send("/app/message", {}, JSON.stringify(chatMessage));//mesaj gönderiliyor.
                });
                setUserData({ ...userData, "message": "" });//mesaj textboxu boşaltılıyor.
            }
        } else {
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }

    }
    const sendGroupValue = () => {//Kullanıcı gruba mesaj gönderdiğinde  bu fonksiyon çalışıyor
        if (userData.message !== "" && userData.message.length < 255) {//mesajın uzunluğu kontrol ediliyor (boş olmamalı ve en fazla 255 karakter olmalı).
            if (stompClient) {
                var chatMessage = {//Bir mesaj oluşturuluyor ve status değerine GROUP_MESSAGE ve received yani iletildi alanına "No" atanıyor.
                    senderName: userData.username,
                    receiverName: "",
                    message: userData.message,
                    status: "GROUP_MESSAGE",
                    received: "No"//"No" olmasının sebebi gönderilen kullanıcı offline ise giriş yaptığında sonradan okuyabiliyor.
                };

                inGroupUsernames.forEach(user => { //gruptaki tüm kullanıcılara bu mesaj yollanıyor.
                    const index = onlineUsernames.indexOf(user);//eğer kullanıcı hali hazırda online ise received yani iletildi alanı "Yes" yapılıyor
                    if (index > -1) {
                        chatMessage.received = "Yes";
                    } else {
                        chatMessage.received = "No";
                    }
                    chatMessage.receiverName = user;
                    stompClient.send("/app/groupMessage", {}, JSON.stringify(chatMessage));//gruptaki tüm kullanıcılara aynı mesaj gönderiliyor.
                });
                setUserData({ ...userData, "message": "" });//mesaj texboxu boşaltılıyor.
            }
        } else {
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }

    }

    const exit = () => {//kullanıcı sağ yukarıdaki x (çıkış) butonuna bastığında çalışır
        var chatMessage = {
            senderName: userData.username,
            receiverName: "",
            message: onlineUsernames,
        };

        const index = onlineUsernames.indexOf(userData.username);//çıkış yapan kullanıcı onlineUsernames dizisinden çıkar.
        if (index > -1) {
            onlineUsernames.splice(index, 1);
        }
        chatMessage.message = onlineUsernames;
        for (var i = 0; i < onlineUsernames.length; i++) {//ve çıkış işlemi diğer tüm online kullanıcılara yeni onlineUsernames dizisi gönderilir.
            chatMessage.receiverName = onlineUsernames[i];
            stompClient.send('/app/introduce', {}, JSON.stringify(chatMessage));//yani gönderilen mesaj sayesinde diğer online kullanıcılar güncel onlineUsernames dizisini alır.
        }
        stompClient.disconnect();//Socket disconnect edilir.
        window.location.reload(); //Sayfaya refresh atılır ve kullanıcı, kullanıcı giriş sayfasına yönlendirilir. Giriş yaparsa soket tekrar açılır.
    }

    const sendPrivateValue = () => {//Kullanıcı private mesaj yani başka bir kullanıcıya mesaj attığında bu fonksiyon çalışır.
        if (userData.message !== "" && userData.message.length < 255) {//gönderilecek mesaj kontrol edilir (boş olmamalı ve en fazla 255 karakter olmalı).
            if (stompClient) {
                var chatMessage = {//Bir mesaj oluşturuluyor ve status değerine PRIVATE_MESSAGE ve received yani iletildi alanına "No" atanıyor.
                    senderName: userData.username,
                    receiverName: tab,
                    message: userData.message,
                    status: "PRIVATE_MESSAGE",
                    received: "No"
                };
                const index = onlineUsernames.indexOf(chatMessage.receiverName);//mesajı göndereceğimiz kullanıcı hali hazırda online ise received alanını "Yes" yapıyorum. 
                if (index > -1) {
                    chatMessage.received = "Yes";
                }
                if (userData.username !== tab) {
                    privateChats.get(tab).push(chatMessage);//gönderilen mesajın görüntülenmesi sağlanılıyor.
                    setPrivateChats(new Map(privateChats));
                }
                stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));//mesaj gönderiliyor.
                setUserData({ ...userData, "message": "" });//Mesaj textboxu temizleniyor.
            }
        } else {
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }
    }
    const handleUsername = (event) => {//girişteki kullanıcı adı kısmını userData.username alanına atar.
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    }

    const handlePassword = (event) => {//girişteki şifre kısmını userData.password alanına atar.
        const { value } = event.target;
        setUserData({ ...userData, "password": value });
    }

    const registerUser = () => {//kullanıcı "Bağlan" butonuna bastığında kullanıcı adı ve şifre alanlarını kontrol ediyoruz.
        if (userData.username.length > 15) {//Eğer herhangi bir hata yoksa connect() methodunu çağırıyorum.
            alert("Kullanıcı adı maksimum 15 karakter olabilir!");
        } else if (userData.username.length < 3) {
            alert("Kullanıcı adı minimum 3 karakter olmalıdır!");
        }
        else if (userData.password.length < 5) {
            alert("Şifre minimum 6 karakter olmalıdır!");
        }
        else if (userData.password.length > 15) {
            alert("Şifre maksimum 15 karakter olabilir!");
        } else {
            connect();
        }
    }
    const addUserToGroup = (name, index) => {//kullanıcı gruba girdiğinde backende status alanı "INFO" olan ve mesaj alanı "true" olan bir mesaj yollar
        var chatMessage = {
            senderName: userData.username,
            message: "true",
            status: "INFO"
        };
        setVisible(true);//visible değerini true yapar bu sayede kullanıcı mesaj yazıp gönder tuşuna basabilir
        stompClient.send("/app/groupMessage", {}, JSON.stringify(chatMessage));//yollanılan bu mesaj client'a geldiğinde onMessageReceived() fonksiyonunda işlenir.
    }
    const removeUserFromGroup = (name, index) => {//kullanıcı gruptan çıktığında backende status alanı "INFO" olan ve mesaj alanı "false" olan bir mesaj yollanır
        var chatMessage = {
            senderName: userData.username,
            message: "false",
            status: "INFO"
        };
        setVisible(false);//visible değerini false yapar bu sayede kullanıcı mesaj yazma alanını ve butonu görüntüleyemez.
        stompClient.send("/app/groupMessage", {}, JSON.stringify(chatMessage));//yollanılan bu mesaj client'a geldiğinde onMessageReceived() fonksiyonunda işlenir.

    }
    return (
        <div className="container">
            {userData.connected ?
                <div className="chat-box">
                    <div className="buttons">
                        <button type="button" className="exit-button" onClick={exit}>x</button>
                    </div>
                    <div className="member-list">
                        <h4>Merhaba {userData.username}</h4>
                        <ul>
                            <li onClick={() => { setTab("CHATROOM") }} className={`member ${tab === "CHATROOM" && "active"}`}>Herkese Açık Sohbet</li>
                            {[...privateChats.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>{name}</li>
                            ))}
                            <li onClick={() => { setTab("GROUP") }} className={`member ${tab === "GROUP" && "active"}`}>Grup Sohbet</li>
                        </ul>
                    </div>

                    {tab === "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>Gönder</button>
                        </div>
                    </div>}

                    {tab === "GROUP" && <div className="chat-content">
                        <div className="buttons">
                            {!visible && <button id="join-group-button" type="button" className="join-group-button" onClick={addUserToGroup}>Gruba Katıl</button>}
                            {visible && <button id="exit-group-button" type="button" className="exit-group-button" onClick={removeUserFromGroup} >Gruptan Ayrıl</button>}
                        </div>
                        <ul className="chat-messages">
                            {groupChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            {visible && <input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />}
                            {visible && <button type="button" className="send-button" onClick={sendGroupValue}>Gönder</button>}
                            {!visible && <h3>Mesaj göndermek ve görüntülemek için gruba katılmanız gerekiyor!</h3>}
                        </div>


                    </div>}

                    {(tab !== "CHATROOM" && tab !== "GROUP") && <div className="chat-content">
                        <ul className="chat-messages">
                            {[...privateChats.get(tab)].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>Gönder</button>
                        </div>
                    </div>}
                </div>
                :
                <div className="register">
                    <form>
                        <h4>Merhaba, giriş yaparak sohbete bağlanın.</h4>
                        <div className="registerInput">
                            <input
                                type="text"
                                id="user-name"
                                placeholder="Kullanıcı adı giriniz."
                                name="userName"
                                value={userData.username}
                                onChange={handleUsername}
                                margin="normal"
                            />
                        </div>
                        <div className="registerInput">
                            <input
                                type="password"
                                id="password"
                                placeholder="Şifre giriniz."
                                name="password"
                                value={userData.password}
                                onChange={handlePassword}
                                margin="normal"
                            />
                        </div>
                        <div className="registerInput">
                            <button type="button" style={{}} onClick={registerUser}>
                                Bağlan
                            </button>
                        </div>
                    </form>
                </div>}
        </div>
    )
}

export default ChatRoom
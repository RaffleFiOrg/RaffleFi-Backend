import requests 
import urllib.parse

data = [
    '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', 
    '0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258', 
    '0x60e4d786628fea6478f785a6d7e704777c86a7c6', 
    '0xffc1131dda0299b804c97c436bc8cfea019e00a0',
    '0xf13f29330dca76be26a6c7e268da836aef978e11',
    '0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b',
    '0xa9ba1a433ec326bca975aef9a1641b42717197e7',
    '0xac5c7493036de60e63eb81c5e9a440b42f47ebf5',
    '0x5bf0438cbfcc9d7e085759a27e4d87c49428d49c',
    '0x23581767a106ae21c074b2276d25e5c3e136a68b',
    '0xdcf68c8ebb18df1419c7dff17ed33505faf8a20c',
    '0xd1258db6ac08eb0e625b75b371c023da478e94a9',
    '0xed5af388653567af2f388e6224dc7c4b3241c544',
    '0x209e639a0ec166ac7a1a4ba41968fa967db30221',
    '0x705b9dbd0d5607beafe12e2fb74d64268d3ba35f',
    '0x08d7c0242953446436f34b4c78fe9da38c73668d',
    '0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7',
    '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e',
    '0xc86664e7d2608f881f796ee8e24fa9d4d7598406',
    '0x9df8aa7c681f33e442a0d57b838555da863504f3',
    '0x12632d6e11c6bbc0c53f3e281ea675e5899a5df5',
    '0x9370045ce37f381500ac7d6802513bb89871e076'
    ]

resp = requests.post('http://localhost:8003/create-lottery',
 json={'addresses': data, 'month': 1}, headers={'Content-Type': 'application/json'})

print(resp.text)


# resp = requests.get(
#     'http://localhost:8003/monthly/proofs/' + urllib.parse.quote_plus('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')+ '/1')

# print(resp)